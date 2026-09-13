/**
 * تحييد «الكود السري المعروف» لمطعم kafy (SEC-004):
 * الكود 2481 منشور في git (seed + migration قديمان) — أي وجود له في الإنتاج
 * يتيح دخول موظفين غير مصرّح به. يُستبدل بعشوائي فريد لا يُطبع أبدًا
 * (يراه المالك فقط عبر لوحة الإدارة → إعدادات الموظفين).
 * idempotent: إن لم يكن الكود الحالي هو المنشور لا يلمس شيئًا.
 * التشغيل: node scripts/rotate-known-pin.cjs
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

async function uniqueRandomPin(c) {
  for (let i = 0; i < 20; i++) {
    const pin = String(crypto.randomInt(1000, 10000));
    const r = await c.query(`SELECT 1 FROM "Restaurant" WHERE "staffPin" = $1`, [pin]);
    if (r.rowCount === 0) return pin;
  }
  throw new Error("تعذّر توليد كود موظفين فريد");
}

async function main() {
  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  const c = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  await c.connect();
  try {
    const r = await c.query(`SELECT "id", "staffPin" FROM "Restaurant" WHERE "slug" = 'kafy'`);
    if (r.rowCount === 0) throw new Error("kafy غير موجود");
    const pin = r.rows[0].staffPin;
    if (pin !== "2481") {
      console.log("✓ الكود الحالي ليس المنشور المعروف — لا تغيير (idempotent)");
      return;
    }
    await c.query(`UPDATE "Restaurant" SET "staffPin" = $1, "pinFailedAttempts" = 0 WHERE "id" = $2`, [
      await uniqueRandomPin(c),
      r.rows[0].id,
    ]);
    console.log("✓ استُبدل الكود السري المنشور بكود عشوائي جديد — المالك يطّلعه من لوحة الإدارة");
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("✗ فشل تحييد الكود السري:", e.message);
  process.exitCode = 1;
});