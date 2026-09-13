/**
 * فحص التوافقية وسلامة الكتابة تحت الحمل المزدوج (PHASE 6.13):
 * سباق 10 متزامنات على نفس nonce، عدّاد OrderWindow الذري، Upsert المتوازي
 * على DayStat، CAS للدفع، وسلسلة أرقام الطلبات.
 * كل صف يُكتب يُحذف بعد الفحص أو يُتراجع (ROLLBACK) — تُستعاد القاعدة لحالتها.
 * التشغيل: node scripts/concurrency-probe.cjs
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv(path.join(__dirname, "..", ".env.local"));
const CONN = { connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 };
const NONCE = "race-probe-nonce-00000000001";
const BUCKET_TS = 1700000000; // دلو نافذة بعيد عن الآن — لا يتداخل مع الإنتاج
const FAR_DATE = "2099-12-31"; // يوم بعيد — لا يتداخل مع إحصائيات الإنتاج

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ✔ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

async function withClient(fn) {
  const c = new Client(CONN);
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function main() {
  let restaurantId;
  await withClient(async (c) => {
    const r = await c.query('SELECT id FROM "Restaurant" ORDER BY "createdAt" LIMIT 1');
    if (!r.rows[0]) throw new Error("لا توجد مطاعم في القاعدة");
    restaurantId = r.rows[0].id;
  });

  /* 1) سباق 10 إرسالات متطابقة على نفس cartNonce — القيد الفريد يصمد أمام التزامن الشامل */
  console.log("■ 10 إرسالات متزامنة بنفس nonce:");
  {
    const clients = [];
    for (let i = 0; i < 10; i++) clients.push(new Client(CONN));
    await Promise.all(clients.map((c) => c.connect()));
    try {
      const results = await Promise.all(
        clients.map(async (c) => {
          await c.query("BEGIN");
          try {
            await c.query(
              `INSERT INTO "Order" (id,"restaurantId",number,type,"customerName",total,"cartNonce")
               VALUES ('${crypto.randomUUID()}', '${restaurantId}', nextval('order_number_seq'),
                       'dine-in', '__race_test', 10, '${NONCE}')`,
            );
            await c.query("COMMIT");
            return { ok: true };
          } catch (e) {
            await c.query("ROLLBACK").catch(() => {});
            return { ok: false, code: e.code };
          }
        }),
      );
      const okCount = results.filter((r) => r.ok).length;
      const denied = results.filter((r) => !r.ok && r.code === "23505").length;
      check("من 10 متزامنين واحد فقط يكسب (الـ nonce حُسم)", okCount === 1, `(ok=${okCount})`);
      check("الـ 9 الباقون رُفضوا unique_violation (23505)", denied === 9, `(denied=${denied})`);
    } finally {
      await Promise.all(clients.map((c) => c.end().catch(() => {})));
      await withClient(async (c) => {
        await c.query('DELETE FROM "Order" WHERE "cartNonce" = $1', [NONCE]);
      });
    }
  }

  /* 2) Upsert متوازٍ على نفس صف DayStat — بلا deadlock وبلا فقدان عدّاد */
  console.log("■ Upsert متوازٍ على DayStat (8 اتصالات، نفس الصف):");
  {
    const pre = await withClient((c) =>
      c.query('SELECT count(*)::int AS n FROM "DayStat" WHERE "restaurantId" = $1 AND date = $2', [
        restaurantId,
        FAR_DATE,
      ]),
    );
    if (pre.rows[0].n !== 0) throw new Error("الصف البعيد موجود مسبقًا — الفحص غير آمن");
    const clients = [];
    for (let i = 0; i < 8; i++) clients.push(new Client(CONN));
    await Promise.all(clients.map((c) => c.connect()));
    try {
      const res = await Promise.all(
        clients.map(async (c, i) => {
          try {
            const r = await c.query(
              `INSERT INTO "DayStat" (id, "restaurantId", date, orders, revenue)
               VALUES ($1, $2, $3, 1, 10)
               ON CONFLICT ("restaurantId", date)
               DO UPDATE SET orders = "DayStat".orders + 1,
                             revenue = "DayStat".revenue + 10
               RETURNING orders, revenue`,
              [`race-probe-${Date.now()}-${i}`, restaurantId, FAR_DATE],
            );
            return { ok: true, row: r.rows[0] };
          } catch (e) {
            return { ok: false, code: e.code };
          }
        }),
      );
      const okCount = res.filter((r) => r.ok).length;
      const finalOrders = Math.max(...res.filter((r) => r.ok).map((r) => r.row.orders));
      const finalRevenue = Math.max(...res.filter((r) => r.ok).map((r) => Number(r.row.revenue)));
      check(
        "كل الـ 8 Upsert نجحت (لا deadlock في وضع الجملة المفردة)",
        okCount === 8,
        `(fail=${res.filter((r) => !r.ok).map((l) => l.code).join(",")})`,
      );
      check(
        "العدّاد النهائي = 8 والإيراد = 80 (لا فقدان في السباق)",
        finalOrders === 8 && finalRevenue === 80,
        `(orders=${finalOrders}, revenue=${finalRevenue})`,
      );
    } finally {
      await Promise.all(clients.map((c) => c.end().catch(() => {})));
      await withClient(async (c) => {
        await c.query('DELETE FROM "DayStat" WHERE "restaurantId" = $1 AND date = $2', [
          restaurantId,
          FAR_DATE,
        ]);
      });
    }
  }

  /* 3) عدّاد OrderWindow الذري تحت التزامن — كل الزيادات تُحتسب */
  console.log("■ عدّاد النافذة: 10 Upsert متوازية على نفس الدلو:");
  {
    const clients = [];
    for (let i = 0; i < 10; i++) clients.push(new Client(CONN));
    await Promise.all(clients.map((c) => c.connect()));
    try {
      const res = await Promise.all(
        clients.map(async (c) => {
          const r = await c.query(
            `INSERT INTO "OrderWindow" ("restaurantId", "windowStart", count)
             VALUES ($1, to_timestamp($2), 1)
             ON CONFLICT ("restaurantId", "windowStart")
             DO UPDATE SET count = "OrderWindow".count + 1
             RETURNING count`,
            [restaurantId, BUCKET_TS],
          );
          return r.rows[0].count;
        }),
      );
      const finalCount = Math.max(...res);
      const exact = await withClient((c) =>
        c
          .query(
            `SELECT count AS n FROM "OrderWindow"
             WHERE "restaurantId" = $1 AND "windowStart" = to_timestamp($2)`,
            [restaurantId, BUCKET_TS],
          )
          .then((r) => r.rows[0]?.n ?? 0),
      );
      check(
        "الـ 10 زيادات متزامنة تُحتسب جميعًا (لا فقدان في السباق)",
        exact === 10 && finalCount === 10,
        `(final=${finalCount}, exact=${exact})`,
      );
    } finally {
      await Promise.all(clients.map((c) => c.end().catch(() => {})));
      await withClient((c) =>
        c.query(
          'DELETE FROM "OrderWindow" WHERE "restaurantId" = $1 AND "windowStart" = to_timestamp($2)',
          [restaurantId, BUCKET_TS],
        ),
      );
    }
  }

  /* 4) CAS للدفع: 5 مزامنات تحدث صفًا واحدًا فقط من PENDING→PAID */
  console.log("■ CAS الدفع: 5 تحديثات متزامنة على نفس الفاتورة:");
  {
    const paymentId = crypto.randomUUID();
    await withClient(async (c) => {
      await c.query(
        `INSERT INTO "Payment" (id, "restaurantId", status, amount, "paymobRef")
         VALUES ($1, $2, 'PENDING', 100, $3)`,
        [paymentId, restaurantId, "race-cas-test-" + Date.now()],
      );
    });
    const clients = [];
    for (let i = 0; i < 5; i++) clients.push(new Client(CONN));
    await Promise.all(clients.map((x) => x.connect()));
    try {
      const res = await Promise.all(
        clients.map(async (x) => {
          try {
            const r = await x.query(
              `UPDATE "Payment" SET status = 'PAID' WHERE id = $1 AND status = 'PENDING'`,
              [paymentId],
            );
            return r.rowCount;
          } catch {
            return -1;
          }
        }),
      );
      const paid = res.filter((n) => n === 1).length;
      check("من 5 محاولات تحويل، واحدة فقط نجحت (CAS حصري)", paid === 1, `(paid=${paid})`);
    } finally {
      await Promise.all(clients.map((x) => x.end().catch(() => {})));
      await withClient((c) => c.query('DELETE FROM "Payment" WHERE id = $1', [paymentId]));
    }
  }

  /* 5) سلسلة الأرقام: nextval متوازي يعطي أرقامًا فريدة دائمًا */
  console.log("■ سلسلة أرقام الطلبات تحت التزامن:");
  {
    await withClient(async (c) => {
      const res = await Promise.all(
        Array.from({ length: 10 }, () => c.query("SELECT nextval('order_number_seq') AS n")),
      );
      const nums = res.map((r) => r.rows[0].n);
      check("10 nextval متوازية → 10 أرقام مختلفة", new Set(nums).size === 10);
    });
  }

  console.log(failures === 0 ? "\n✓ PHASE 6.13: كل فحوص التوافقية ناجحة" : `\n✗ فشل ${failures} فحص`);
  process.exitCode = failures === 0 ? 0 : 1;
}

const watchdog = new Promise((_, rej) =>
  setTimeout(() => rej(new Error("انتهت مهلة فحص التوافقية (90 ثانية)")), 90_000),
);

Promise.race([main(), watchdog]).catch((e) => {
  console.error("✗ خطأ تشغيلي:", e.message);
  process.exitCode = 1;
});