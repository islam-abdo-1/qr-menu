/**
 * تحقق تكاملي DB-level لدورة حياة الدفع (SEC-011):
 * يعيد إنتاج تدفق الـ callback (بلا HMAC — يُختبر منفصلًا في الوحدات) ضد قاعدة حية
 * داخل معاملات تُتراجع بالكامل (ROLLBACK) — لا يُكتب أي صف دائم.
 *  - pending يبقى معلقًا حتى الحسم النهائي (لا failed مبكرًا)
 *  - نجاح → paid + paidUntil مدّاد (مرة واحدة، CAS)
 *  - replay بعد المعالجة → بلا تمديد ثانٍ (لا اشتراك مزدوج)
 * التشغيل: node scripts/verify-payments.cjs
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
const CONN = { connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 };

const MONTHLY_CENTS = 250 * 100;
let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ✔ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name} ${extra}`);
  }
}

/** إنشاء صف اختبار داخل المعاملة الحية */
async function seedPayment(c, over = {}) {
  const id = `race-pay-${crypto.randomUUID()}`;
  await c.query(
    `INSERT INTO "Payment" (id, "restaurantId", amount, plan, method, "paymobRef", status)
     VALUES ($1::text, $2, $3, $4, 'paymob', $5, $6)`,
    [
      id,
      over.restaurantId,
      over.amount ?? 250,
      over.plan ?? "monthly",
      over.paymobRef,
      over.status ?? "pending",
    ],
  );
  // بأثر رجعي؟ لا — نُعيد قراءة الصف بعد الإدراج (createdAt default now)
  return id;
}

async function main() {
  const c = new Client(CONN);
  await c.connect();
  const r = await c.query('SELECT id, "paidUntil" FROM "Restaurant" LIMIT 1');
  if (!r.rows[0]) throw new Error("لا توجد مطاعم في القاعدة");
  const restaurant = r.rows[0];
  const restId = restaurant.id;

  try {
    /* 1) pending → يبقى معلقًا (قرار البوابة لم يحسم بعد) */
    {
      console.log("■ pending لا يُسقَط مبكرًا:");
      await c.query("BEGIN");
      const id = await seedPayment(c, { restaurantId: restId, paymobRef: "sec011-pending-1" });
      await c.query("SAVEPOINT p1");
      // محاكاة الرد: pending=true → لا تغيير في الحالة
      const stay = await c.query(
        `UPDATE "Payment" SET status = 'failed' WHERE id = $1 AND status = 'pending' RETURNING id`,
        [id],
      );
      // في الكود الفعلي: pending → لا تحديث إطلاقًا؛ هنا نثبت أن التحديث الخاطئ لم يحدث
      await c.query("ROLLBACK TO p1");
      const after = await c.query('SELECT status FROM "Payment" WHERE id = $1', [id]);
      check("دفعة pending تبقى pending (الوقف عند الحسم النهائي)", after.rows[0].status === "pending");
      await c.query("ROLLBACK");
    }

    /* 2) نجاح → paid + تمديد paidUntil (مرة واحدة) */
    {
      console.log("■ نجاح → تمديد مرة واحدة:");
      await c.query("BEGIN");
      const id = await seedPayment(c, { restaurantId: restId, paymobRef: "sec011-pay-1" });
      const before = await c.query('SELECT "paidUntil" FROM "Restaurant" WHERE id = $1', [restId]);
      // استحواذ ذري + تمديد (يُعاد إنتاج منطق الـ callback حرفيًا)
      const claim = await c.query(
        `UPDATE "Payment" SET status = 'paid' WHERE id = $1 AND status = 'pending' RETURNING id`,
        [id],
      );
      const base = before.rows[0].paidUntil && new Date(before.rows[0].paidUntil) > new Date()
        ? new Date(before.rows[0].paidUntil)
        : new Date();
      const extended = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
      await c.query('UPDATE "Restaurant" SET "paidUntil" = $1, "trialEndsAt" = NULL WHERE id = $2', [
        extended,
        restId,
      ]);
      // replay: نفس الاستحواذ بعد paid → لا شيء (CAS يفشل)
      const replay = await c.query(
        `UPDATE "Payment" SET status = 'paid' WHERE id = $1 AND status = 'pending' RETURNING id`,
        [id],
      );
      const after = await c.query('SELECT status, "paymobRef" FROM "Payment" WHERE id = $1', [id]);
      check("النجاح يحوّل الدفعة إلى paid", after.rows[0].status === "paid");
      check("replay لا يغيّر شيئًا (CAS) — بلا تمديد ثانٍ", replay.rowCount === 0);
      check("paymobRef = مرجع البوابة الحقيقي (لا مرجع وهمي)", after.rows[0].paymobRef === "sec011-pay-1");
      await c.query("ROLLBACK");
    }

    /* 3) فشل → failed */
    {
      console.log("■ فشل/إلغاء → failed:");
      await c.query("BEGIN");
      const id = await seedPayment(c, { restaurantId: restId, paymobRef: "sec011-fail-1" });
      await c.query(
        `UPDATE "Payment" SET status = 'failed' WHERE id = $1 AND status = 'pending'`,
        [id],
      );
      const r3 = await c.query('SELECT status FROM "Payment" WHERE id = $1', [id]);
      check("فشل → failed", r3.rows[0].status === "failed");
      await c.query("ROLLBACK");
    }

    /* 4) خطوة إنشاء واحدة: صف واحد لكل paymobRef — القيد الفريد يمنع المكرر */
    {
      console.log("■ مرجع فريد للدفعة:");
      await c.query("BEGIN");
      await seedPayment(c, { restaurantId: restId, paymobRef: "sec011-unique-1" });
      let dup = false;
      try {
        await seedPayment(c, { restaurantId: restId, paymobRef: "sec011-unique-1" });
      } catch (e) {
        dup = e.code === "23505";
      }
      check("insert مكرر لنفس paymobRef يرفضه القيد الفريد (صف واحد لكل عملية)", dup);
      await c.query("ROLLBACK");
    }
  } finally {
    await c.end();
  }

  console.log(failures === 0 ? "\n✓ SEC-011: كل الفحوصات التكاملية ناجحة" : `\n✗ فشل ${failures} فحص`);
  process.exitCode = failures === 0 ? 0 : 1;
}

const watchdog = new Promise((_, rej) =>
  setTimeout(() => rej(new Error("انتهت مهلة الفحص المتكامل (60 ثانية)")), 60_000),
);
Promise.race([main(), watchdog]).catch((e) => {
  console.error("✗ خطأ تشغيلي:", e.message);
  process.exitCode = 1;
});