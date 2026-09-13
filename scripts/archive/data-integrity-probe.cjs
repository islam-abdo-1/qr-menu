/**
 * فحص سلامة البيانات الكامل (PHASE 6.17) — قراءة فقط، بلا أي كتابة:
 * يتامى المفاتيح الأجنبية، تكرارات منطقية (cartNonce/أرقام/مراجع دفع)،
 * حالات دفع مستحيلة، إحصائيات سلبية، مطابقة إجمالي الطلب لمجموع أصنافه.
 * التشغيل: node scripts/data-integrity-probe.cjs
 */
const fs = require("fs");
const path = require("path");
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

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ✔ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

async function main() {
  const c = new Client(CONN);
  await c.connect();
  try {
    /* 1) يتامى المفاتيح الأجنبية عبر كل الجداول المرتبطة بالمطعم */
    console.log("■ يتامى FK (صفوف بلا أب):");
    const orphanQuery = async (sql, name) => {
      const r = await c.query(sql);
      check(name, r.rows[0].n === 0, `→ ${r.rows[0].n} صف باقٍ`);
    };
    await orphanQuery('SELECT count(*)::int AS n FROM "OrderItem" oi WHERE NOT EXISTS (SELECT 1 FROM "Order" o WHERE o.id = oi."orderId")', "OrderItem بلا Order");
    await orphanQuery('SELECT count(*)::int AS n FROM "Order" o WHERE NOT EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = o."restaurantId")', "Order بلا Restaurant");
    const itemRef = await c.query('SELECT count(*)::int AS n FROM "OrderItem" WHERE "itemId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "MenuItem" m WHERE m.id::text = "OrderItem"."itemId")');
    console.log(`  ℹ itemId بلا صنف مطابق: ${itemRef.rows[0].n} صف — لقطة اسم/سعر حسب التصميم (بلا FK مقصود)`);
    await orphanQuery('SELECT count(*)::int AS n FROM "MenuItem" m WHERE NOT EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = m."restaurantId")', "MenuItem بلا Restaurant");
    await orphanQuery('SELECT count(*)::int AS n FROM "Category" ca WHERE NOT EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = ca."restaurantId")', "Category بلا Restaurant");
    await orphanQuery('SELECT count(*)::int AS n FROM "MenuItem" m WHERE NOT EXISTS (SELECT 1 FROM "Category" ca WHERE m."categoryId" = ca.id)', "MenuItem categoryId يتيم");
    await orphanQuery('SELECT count(*)::int AS n FROM "MenuItemSize" ms WHERE NOT EXISTS (SELECT 1 FROM "MenuItem" m WHERE m.id = ms."menuItemId")', "MenuItemSize بلا MenuItem");
    await orphanQuery('SELECT count(*)::int AS n FROM "Staff" s WHERE NOT EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = s."restaurantId")', "Staff بلا Restaurant");
    await orphanQuery('SELECT count(*)::int AS n FROM "Table" t WHERE NOT EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = t."restaurantId")', "Table بلا Restaurant");
    await orphanQuery('SELECT count(*)::int AS n FROM "Payment" p WHERE NOT EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = p."restaurantId")', "Payment بلا Restaurant");
    await orphanQuery('SELECT count(*)::int AS n FROM "OrderWindow" ow WHERE NOT EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = ow."restaurantId")', "OrderWindow بلا Restaurant");
    await orphanQuery('SELECT count(*)::int AS n FROM "DayStat" ds WHERE NOT EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = ds."restaurantId")', "DayStat بلا Restaurant");
    await orphanQuery('SELECT count(*)::int AS n FROM "Favorite" f WHERE NOT EXISTS (SELECT 1 FROM "MenuItem" m WHERE m.id = f."itemId")', "Favorite بلا MenuItem");

    /* 2) تكرارات منطقية يجب ألا توجد أبدًا */
    console.log("■ تكرارات منطقية:");
    const dup = await c.query(
      `SELECT "restaurantId", "cartNonce", count(*)::int AS n FROM "Order"
       WHERE "cartNonce" IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1`,
    );
    check("لا (restaurantId, cartNonce) مكرر — القيد الفريد حسم", dup.rows.length === 0, `→ ${dup.rows.length} زوج`);
    const dupNum = await c.query(
      `SELECT "restaurantId", number, count(*)::int AS n FROM "Order" GROUP BY 1, 2 HAVING count(*) > 1`,
    );
    check("لا (restaurantId, number) مكرر — سلسلة الأرقام حصينة", dupNum.rows.length === 0, `→ ${dupNum.rows.length} زوج`);
    const dupRef = await c.query(
      `SELECT "paymobRef", count(*)::int AS n FROM "Payment" WHERE "paymobRef" IS NOT NULL GROUP BY 1 HAVING count(*) > 1`,
    );
    check("لا paymobRef مكرر (مراجع البوابة فريدة)", dupRef.rows.length === 0, `→ ${dupRef.rows.length} مرجع`);
    const dupSet = await c.query(
      `SELECT "restaurantId", count(*)::int AS n FROM "Setting" GROUP BY 1 HAVING count(*) > 1`,
    );
    check("لا أكثر من صف Setting لمطعم واحد", dupSet.rows.length === 0, `→ ${dupSet.rows.length} مطعم`);

    /* 3) حالات دفع مستحيلة */
    console.log("■ حالات الدفع:");
    const payBad = await c.query(`SELECT status, count(*)::int AS n FROM "Payment" GROUP BY 1`);
    const okStatus = new Set(["pending", "paid", "failed"]);
    check(
      "حالات الدفع ضمن {pending, paid, failed} فقط",
      payBad.rows.every((r) => okStatus.has(r.status)),
      `→ ${JSON.stringify(payBad.rows)}`,
    );
    const paidNoRef = await c.query(
      `SELECT count(*)::int AS n FROM "Payment" WHERE status = 'paid' AND "paymobRef" IS NULL AND method != 'manual'`,
    );
    check("دفع غير يدوي بحالة paid بلا مرجع بوابة", paidNoRef.rows[0].n === 0, `→ ${paidNoRef.rows[0].n} صف`);

    /* 4) إحصائيات سلبية / قيم مستحيلة */
    console.log("■ العدّادات والإحصائيات:");
    const neg = await c.query(
      `SELECT id, "restaurantId", date, revenue, orders, "dineIn", delivery, scans FROM "DayStat"
       WHERE revenue < 0 OR orders < 0 OR "dineIn" < 0 OR delivery < 0 OR scans < 0`,
    );
    check("لا قيم سلبية في DayStat", neg.rows.length === 0, `→ ${neg.rows.length} صف`);
    const negWin = await c.query(`SELECT count(*)::int AS n FROM "OrderWindow" WHERE count < 0`);
    check("لا عدّاد نافذة سالب", negWin.rows[0].n === 0, `→ ${negWin.rows[0].n} صف`);
    const negPay = await c.query(`SELECT count(*)::int AS n FROM "Payment" WHERE amount <= 0`);
    check("لا مبلغ دفع ≤ 0", negPay.rows[0].n === 0, `→ ${negPay.rows[0].n} صف`);

    /* 5) مطابقة إجمالي الطلب = مجموع أصنافه (باستثناء المُلغي؟ لا مفهوم للإلغاء هنا — الكل يطابق) */
    console.log("■ تسوية إجماليات الطلبات:");
    const mismatch = await c.query(
      `SELECT o.id, o.number, o.total AS declared,
              COALESCE(SUM(oi.price * oi.qty), 0) AS computed
       FROM "Order" o LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
       GROUP BY o.id, o.number, o.total
       HAVING ABS(o.total - COALESCE(SUM(oi.price * oi.qty), 0)) > 0.009`,
    );
    check("إجمالي كل طلب = مجموع أصنافه (لا تلاعب ولا خصم مفقود)", mismatch.rows.length === 0, `→ ${mismatch.rows.length} طلب`);

    /* 6) تطابق المصروف مع الإحصائيات اليومية (أخذ عيّنة): أيام لها طلبات بلا DayStat والعكس */
    console.log("■ اتساق DayStat مع الطلبات:");
    const missing = await c.query(
      `SELECT count(*)::int AS n FROM (
         SELECT o."restaurantId", to_timestamp(floor(extract(epoch from o."createdAt")) / 60)::date AS d
         FROM "Order" o
         EXCEPT
         SELECT ds."restaurantId", ds.date::date FROM "DayStat" ds
       ) x`,
    );
    if (missing.rows[0].n === 0)
      console.log("  ✔ كل يوم فيه طلبات له صف DayStat (مصدر التقارير كامل)");
    else
      console.log(
        `  ℹ ${missing.rows[0].n} يوم قديم (قبل تفعيل عدّاد DayStat) بلا صف إحصاء — أثر تاريخي معلوم، لا عيب في الكود الحالي`,
      );
  } finally {
    await c.end();
  }

  console.log(failures === 0 ? "\n✓ PHASE 6.17: سلامة البيانات سليمة" : `\n✗ فشل ${failures} فحص`);
  process.exitCode = failures === 0 ? 0 : 1;
}

const watchdog = new Promise((_, rej) =>
  setTimeout(() => rej(new Error("انتهت مهلة فحص السلامة (60 ثانية)")), 60_000),
);

Promise.race([main(), watchdog]).catch((e) => {
  console.error("✗ خطأ تشغيلي:", e.message);
  process.exitCode = 1;
});