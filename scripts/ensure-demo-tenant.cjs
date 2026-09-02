/**
 * إنشاء مستأجر العرض التجريبي العام في الإنتاج (SEC-004):
 * - نسخة معزولة من منيو kafy تحت slug = "demo"، بلا مالك (ownerId placeholder)،
 *   بلا موظفين، بلا طاولات، بلا سجل طلبات — تُبنى مرة واحدة فقط (idempotent).
 * - كود الموظفين عشوائي غير معلوم (لا يُطبع أبدًا).
 * - لا يُحذف أو يُعدّل أي شيء من kafy أو أي مستأجر آخر.
 * التشغيل: node scripts/ensure-demo-tenant.cjs
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

/** كود موظفين عشوائي غير مستخدم من مطعم آخر — بلا طباعة أبدًا */
async function uniqueRandomPin(c) {
  for (let i = 0; i < 20; i++) {
    const pin = String(crypto.randomInt(1000, 10000));
    const r = await c.query(`SELECT 1 FROM "Restaurant" WHERE "staffPin" = $1`, [pin]);
    if (r.rowCount === 0) return pin;
  }
  throw new Error("تعذّر توليد كود موظفين فريد");
}

async function copyRows(c, fromTable, toTable, extraColumn, extraValue, skipColumns) {
  const cols = await c.query(
    `SELECT "column_name", "is_nullable", "column_default"
     FROM information_schema.columns
     WHERE "table_schema" = current_schema() AND "table_name" = $1
     ORDER BY "ordinal_position"`,
    [fromTable],
  );
  const copyable = cols.rows.filter((col) => {
    if (col.column_name === "id" || col.column_name === "restaurantId") return false;
    if (skipColumns.includes(col.column_name)) return false;
    if (col.is_nullable === "NO" && !col.column_default) return false;
    return true;
  });
  if (copyable.length === 0) return 0;
  const names = copyable.map((c) => `"${c.column_name}"`);
  const src = await c.query(`SELECT ${names.join(", ")} FROM "${fromTable}" WHERE "restaurantId" = $1`, [extraValue]);
  const values = [];
  const params = [];
  for (const row of src.rows) {
    values.push(
      `(${names.map((_, i) => `$${params.length + i + 1}`).join(", ")}, ${extraColumn})`,
    );
    params.push(...copyable.map((c, i) => row[copyable[i].column_name]));
  }
  if (values.length === 0) return 0;
  await c.query(
    `INSERT INTO "${toTable}" (${names.join(", ")}, "restaurantId") VALUES ${values.join(", ")}`,
    params,
  );
  return values.length;
}

async function main() {
  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  const c = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  await c.connect();
  c.on("error", () => {});
try {
    // تعقّب فوري للعبارات الفاشلة (بلا قيم حساسة) — يسهّل إصلاح اختلافات الأعمدة
    const origQuery = c.query.bind(c);
    c.query = async (...args) => {
      try {
        return await origQuery(...args);
      } catch (e) {
        const sql = typeof args[0] === "string" ? args[0] : "?";
        console.error("[SQL FAIL]", sql.slice(0, 220));
        throw e;
      }
    };

    // إنجاز تدريجي: إن وُجد المستأجر نُكمل أي جزء ناقص (أقسام/أصناف/إعدادات) — لا فشل بعد إنشاء جزئي
    const existing = await c.query(`SELECT "id" FROM "Restaurant" WHERE "slug" = 'demo'`);
    const src = await c.query(`SELECT * FROM "Restaurant" WHERE "slug" = 'kafy'`);
    if (src.rowCount === 0) throw new Error("kafy غير موجود — لا يمكن نسخ المنيو");
    const kafy = src.rows[0];

    let demoId = existing.rows[0]?.id;
    if (!demoId) {
      demoId = crypto.randomUUID();
      const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await c.query(
        `INSERT INTO "Restaurant"
           ("id", "slug", "name", "ownerId", "staffPin", "billingExempt",
            "trialEndsAt", "paidUntil", "createdAt")
         VALUES ($1, 'demo', $2, 'demo-owner', $3, true, $4, $5, now())`,
        [demoId, kafy.name, await uniqueRandomPin(c), future, future],
      );
      console.log("✓ أُنشئ صف المطعم التجريبي");
    }

    const hasMenu = await c.query(`SELECT 1 FROM "MenuItem" WHERE "restaurantId" = $1 LIMIT 1`, [demoId]);
    if (hasMenu.rowCount > 0) {
      console.log("✓ مستأجر العرض التجريبي مكتمل (أقسام/أصناف موجودة) — لا تغيير (idempotent)");
      return;
    }

    const settingsCnt = await c.query(`SELECT 1 FROM "Setting" WHERE "restaurantId" = $1 LIMIT 1`, [demoId]);
    if (settingsCnt.rowCount === 0) {
      await copyRows(c, "Setting", "Setting", `'${demoId}'`, kafy.id, ["restaurantName"]).then(
        async (n) => {
          if (n > 0) {
            const s = await c.query(`SELECT "restaurantName" FROM "Setting" WHERE "restaurantId" = $1`, [kafy.id]);
            await c.query(`UPDATE "Setting" SET "restaurantName" = $1 WHERE "restaurantId" = $2`, [s.rows[0].restaurantName, demoId]);
          }
        },
      );
    }
    const cats = await c.query(`SELECT * FROM "Category" WHERE "restaurantId" = $1 ORDER BY "sortOrder"`, [kafy.id]);
    let items = 0;
    let sizes = 0;
    for (const cat of cats.rows) {
      const newCatId = crypto.randomUUID();
      await c.query(
        `INSERT INTO "Category" ("id", "name", "sortOrder", "restaurantId", "createdAt")
         VALUES ($1, $2, $3, $4, now())`,
        [newCatId, cat.name, cat.sortOrder, demoId],
      );
      const its = await c.query(`SELECT * FROM "MenuItem" WHERE "restaurantId" = $1 AND "categoryId" = $2`, [kafy.id, cat.id]);
      for (const it of its.rows) {
        const newItemId = crypto.randomUUID();
        const cols = await c.query(
          `SELECT "column_name", "is_nullable", "column_default"
           FROM information_schema.columns
           WHERE "table_schema" = current_schema() AND "table_name" = 'MenuItem'
           ORDER BY "ordinal_position"`,
        );
        // انسخ كل الأعمدة عدا المفاتيح/الطوابع — الأعمدة الإلزامية (name مثلًا)
        // تأتي كاملة من سطر المصدر (SELECT *) دون استثنائها.
        const copyable = cols.rows
          .filter((col) => !["id", "restaurantId", "categoryId", "createdAt"].includes(col.column_name))
          .map((col) => col.column_name);
        const copyVals = copyable.map((n2) => it[n2]);
        // ترتيب القيم يطابق ترتيب الـ placeholders: id ثم القيم المنسوخة ثم restaurantId ثم categoryId
        const used = 1 + copyable.length;
        const colsSql = [`"id"`, ...copyable.map((n2) => `"${n2}"`), `"restaurantId"`, `"categoryId"`, `"createdAt"`];
        await c.query(
          `INSERT INTO "MenuItem" (${colsSql.join(", ")})
           VALUES ($${1}, ${copyable.map((_, i) => `$${i + 2}`).join(", ")}, $${used + 1}, $${used + 2}, now())`,
          [newItemId, ...copyVals, demoId, newCatId],
        );
        items++;
        const szs = await c.query(`SELECT "sizeCode", "price" FROM "MenuItemSize" WHERE "menuItemId" = $1`, [it.id]);
        for (const sz of szs.rows) {
          await c.query(
            `INSERT INTO "MenuItemSize" ("id", "menuItemId", "sizeCode", "price") VALUES ($1, $2, $3, $4)`,
            [crypto.randomUUID(), newItemId, sz.sizeCode, sz.price],
          );
          sizes++;
        }
      }
    }
    console.log(`✓ أُنشئ مستأجر العرض التجريبي: slug=demo | أقسام=${cats.rows.length} | أصناف=${items} | مقاسات=${sizes}`);
    console.log("  (بلا مالك فعلي · بلا موظفين · بلا طاولات · بلا طلبات — قراءة فقط)");
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("✗ فشل إنشاء مستأجر العرض التجريبي:", e.message);
  process.exitCode = 1;
});