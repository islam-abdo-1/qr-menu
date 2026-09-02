const {Client} = require("pg");
const c = new Client({connectionString: "postgresql://postgres:QR_MENU_2303AN@db.chczpvevpfqiyvfwjbro.supabase.co:5432/postgres?connection_limit=2"});

const checkSql = `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260823000000_fix_staffpin_required'`;
const insertSql = `
INSERT INTO "_prisma_migrations" (id, migration_name, finished_at, rolled_back_at, logs, started_at, applied_steps_count, checksum)
VALUES (
    gen_random_uuid(),
    '20260823000000_fix_staffpin_required',
    NOW(),
    NULL,
    'Applied staffPin fix: removed default, added unique constraint, updated existing pins',
    NOW(),
    1,
    'manual-fix'
);
`;

c.connect().then(() => c.query(checkSql))
  .then(r => {
    if (r.rows.length > 0) {
      console.log("Migration already marked as applied");
      return c.end();
    }
    return c.query(insertSql).then(r => {
      console.log("Migration marked as applied:", r.rowCount);
      return c.end();
    });
  })
  .catch(e => console.error(e.message));