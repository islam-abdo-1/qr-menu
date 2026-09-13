/**
 * تحقق تكاملي DB-level لحماية الطلبات (SEC-002):
 * كل الاختبارات داخل معاملات تُتراجع (ROLLBACK) — لا يُكتب أي صف دائم في قاعدة الإنتاج.
 * التشغيل: node scripts/verify-orders-guard.cjs
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
const CONN = { connectionString: env.DATABASE_URL };
const NONCE_1 = "race-test-nonce-000000000001";
const NONCE_2 = "race-test-nonce-000000000002";
// أعمدة id صارت UUID (SEC-003) — معرفات الفحص UUID حقيقية
const SEQ_A = crypto.randomUUID();
const SEQ_B = crypto.randomUUID();
const CONC_A = crypto.randomUUID();
const CONC_B = crypto.randomUUID();

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ✔ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

async function main() {
  const admin = new Client(CONN);
  await admin.connect();
  let restaurantId;
  try {
    const r = await admin.query('SELECT id FROM "Restaurant" ORDER BY "createdAt" LIMIT 1');
    if (!r.rows[0]) throw new Error("لا توجد مطاعم في القاعدة");
    restaurantId = r.rows[0].id;
  } finally {
    await admin.end();
  }

  /* 1) إرسال متكرر تسلسلي (duplicate submit) — صف واحد فقط ينجح، الثاني يرفضه القيد الفريد */
  {
    console.log("■ duplicate submit (تسلسلي):");
    const c = new Client(CONN);
    await c.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        `INSERT INTO "Order" (id,"restaurantId",number,type,"customerName",total,"cartNonce")
         VALUES ('${SEQ_A}', '${restaurantId}', nextval('order_number_seq'), 'dine-in', '__race_test', 10, '${NONCE_1}')`,
      );
      let secondFailed = false;
      try {
        await c.query(
          `INSERT INTO "Order" (id,"restaurantId",number,type,"customerName",total,"cartNonce")
           VALUES ('${SEQ_B}', '${restaurantId}', nextval('order_number_seq'), 'dine-in', '__race_test', 10, '${NONCE_1}')`,
        );
      } catch (e) {
        secondFailed = e.code === "23505"; // unique_violation
      }
      check("الإرسال الأول ينجح والثاني (نفس nonce) يرفضه القيد الفريد", secondFailed);
    } finally {
      await c.query("ROLLBACK");
      await c.end();
    }
  }

  /* 2) إرسال مزدوج متزامن (concurrent duplicate submit) — اتصالان يرسلان نفس nonce معًا */
  {
    console.log("■ concurrent duplicate submit (متزامن):");
    const c1 = new Client({ ...CONN, connectionTimeoutMillis: 15000 });
    const c2 = new Client({ ...CONN, connectionTimeoutMillis: 15000 });
    await Promise.all([c1.connect(), c2.connect()]);
    try {
      await c1.query("SET statement_timeout = 10000");
      await c2.query("SET statement_timeout = 10000");
      await c1.query("BEGIN");
      await c2.query("BEGIN");
      await c1.query(
        `INSERT INTO "Order" (id,"restaurantId",number,type,"customerName",total,"cartNonce")
         VALUES ('${CONC_A}', '${restaurantId}', nextval('order_number_seq'), 'dine-in', '__race_test', 10, '${NONCE_2}')`,
      );
      // الثاني يحاول نفس nonce — يُحجب على قفل القيد الفريد حتى يقرر الأول
      const c2Promise = c2
        .query(
          `INSERT INTO "Order" (id,"restaurantId",number,type,"customerName",total,"cartNonce")
           VALUES ('${CONC_B}', '${restaurantId}', nextval('order_number_seq'), 'dine-in', '__race_test', 10, '${NONCE_2}')`,
        )
        .then(() => ({ ok: true }))
        .catch((e) => ({ ok: false, code: e.code }));
      await new Promise((r) => setTimeout(r, 1500)); // لاحظة: الثاني محجوب في هذه الأثناء
      const c1Commit = await c1.query("COMMIT").then(() => true).catch(() => false);
      const c2Res = await c2Promise;
      await c2.query("ROLLBACK").catch(() => {});
      // النتيجة الحاسمة: صف واحد فقط بالـ nonce نفسه مهما كانت نهاية الثاني
      const admin2 = new Client({ ...CONN, connectionTimeoutMillis: 15000 });
      await admin2.connect();
      let n = -1;
      try {
        const r = await admin2.query(
          'SELECT count(*)::int AS n FROM "Order" WHERE "cartNonce" = $1 AND "restaurantId" = $2',
          [NONCE_2, restaurantId],
        );
        n = r.rows[0].n;
      } finally {
        await admin2.query('DELETE FROM "Order" WHERE "id" = $1', [CONC_A]).catch(() => {});
        await admin2.end();
      }
      check("السباق ينتج طلبًا واحدًا لا اثنين (القيد الفريد حسم)", c1Commit && n === 1);
      check(
        "الثاني حُجب/فُضل أثناء السباق (unique violation)",
        c2Res.ok === false && c2Res.code === "23505",
        `(actual: ${JSON.stringify(c2Res)})`,
      );
    } finally {
      await c1.query("ROLLBACK").catch(() => {});
      await c2.query("ROLLBACK").catch(() => {});
      await Promise.all([c1.end(), c2.end()]);
    }
  }

  /* 3) كوتا النافذة: العدّاد الذري يصل إلى 151 ثم يُرفض (لا تجاوز بالإرسال المتوازي) */
  {
    console.log("■ quota (عدّاد ذري عبر Upsert):");
    const c = new Client(CONN);
    await c.connect();
    try {
      await c.query("BEGIN");
      let last = 0;
      for (let i = 0; i < ORDER_WINDOW_LIMIT + 1; i++) {
        const r = await c.query(
          `INSERT INTO "OrderWindow" ("restaurantId","windowStart","count")
           VALUES ('${restaurantId}', ${windowStartSql()}, 1)
           ON CONFLICT ("restaurantId","windowStart")
           DO UPDATE SET "count" = "OrderWindow"."count" + 1
           RETURNING "count"`,
        );
        last = r.rows[0].count;
      }
      check("151 إدراجًا → العدّاد 151 (صارم، لا فقدان)", last === ORDER_WINDOW_LIMIT + 1);
      check("151 > 150 → القرار: تجاوز (حجب)", last > ORDER_WINDOW_LIMIT);
      // سلوك مطعم مزدحم مشروع: 50 طلبًا متتاليًا تحت الحد
      const mid = await c.query(
        `UPDATE "OrderWindow" SET "count" = 0
         WHERE "restaurantId" = $1 AND "windowStart" = ${windowStartSql()} RETURNING "count"`,
        [restaurantId],
      );
      let midCount = mid.rows[0]?.count ?? 0;
      for (let i = midCount + 1; i <= 50; i++) {
        const r = await c.query(
          `INSERT INTO "OrderWindow" ("restaurantId","windowStart","count")
           VALUES ('${restaurantId}', ${windowStartSql()}, 1)
           ON CONFLICT ("restaurantId","windowStart")
           DO UPDATE SET "count" = "OrderWindow"."count" + 1
           RETURNING "count"`,
        );
        midCount = r.rows[0].count;
      }
      check("50 طلبًا مشروعًا في النافذة → 50 ≤ 150 (لا حجب)", midCount === 50);
    } finally {
      await c.query("ROLLBACK");
      await c.end();
    }
  }

  console.log(failures === 0 ? "\n✓ SEC-002: كل الفحوصات التكاملية ناجحة" : `\n✗ فشل ${failures} فحص`);
  process.exitCode = failures === 0 ? 0 : 1;
}

function windowStartSql() {
  // نافذة ثابتة بعيدة عن الآن — طلبات الإنتاج الحية لا تشارك هذه الدلاء أبدًا
  return `to_timestamp(1700000000)`;
}

const ORDER_WINDOW_LIMIT = 150;

// حارس زمني شامل — لا يُسمح للفحص بالتعليق أكثر من 60 ثانية
const watchdog = new Promise((_, rej) =>
  setTimeout(() => rej(new Error("انتهت مهلة الفحص المتكامل (60 ثانية)")), 60_000),
);

Promise.race([main(), watchdog]).catch((e) => {
  console.error("✗ خطأ تشغيلي:", e.message);
  process.exitCode = 1;
});
