const {Client} = require("pg");
const fs = require("fs");
const c = new Client({connectionString: "postgresql://postgres:QR_MENU_2303AN@db.chczpvevpfqiyvfwjbro.supabase.co:5432/postgres?connection_limit=2"});

async function main() {
  const sql = fs.readFileSync("ai_menu_builder_migration.sql", "utf8");
  await c.connect();
  await c.query(sql);
  console.log("✅ Migration applied");

  // Mark as applied in _prisma_migrations
  const check = await c.query(`SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260824000000_ai_menu_builder'`);
  if (check.rows.length === 0) {
    await c.query(`INSERT INTO "_prisma_migrations" (id, migration_name, finished_at, logs, started_at, applied_steps_count, checksum) VALUES (gen_random_uuid(), '20260824000000_ai_menu_builder', NOW(), 'AI Menu Builder tables', NOW(), 1, 'manual')`);
    console.log("✅ Marked in _prisma_migrations");
  } else {
    console.log("Already marked");
  }
  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
