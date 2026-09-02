/* تطبيق migration يدويًا (الأسلوب المعتمد: PRISMA_DB غير متاح يدويًا لذا نطبّق SQL ثم نسجلها) */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv(file) {
  const out = {};
  const txt = fs.readFileSync(file, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  // نستخدم pooler (DATABASE_URL) على Windows — الاتصال المباشر يعجز عن IPv6
  const client = new Client({ connectionString: env.DATABASE_URL });

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("استخدم: node scripts/apply-migration.cjs <folder-name>");
  const sqlFile = path.join(__dirname, "..", "prisma", "migrations", dir, "migration.sql");
  let sql = fs.readFileSync(sqlFile, "utf8");
  if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1); // تجريد BOM (محررات Windows)
  const checksum = require("crypto").createHash("sha256").update(sql).digest("hex");

  await client.connect();
  try {
    console.log("▶ تطبيق:", dir);
    await client.query("BEGIN");
    await client.query(sql);
    const finished = new Date();
    const name = `${dir}`;
    await client.query(
      `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
       VALUES ($1, $2, $3, $4, NULL, NULL, $5, 1)`,
      [require("crypto").randomUUID(), checksum, finished, name, finished],
    );
    await client.query("COMMIT");
    console.log("✓ تم التطبيق والتسجيل:", dir);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("✗ فشل:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
