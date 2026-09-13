import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DIRECT_URL, max: 1, connectionTimeoutMillis: 10000 });

async function run() {
  const client = await pool.connect();
  try {
    const tables = ['Restaurant','Setting','Category','MenuItem','MenuItemSize','Order','OrderItem','OrderWindow','DayStat','Staff','Table','Payment','AuditLog','OwnerLoginAttempt','SiteSetting'];
    for (const t of tables) {
      const res = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = \'public\'', [t]);
      console.log(t, ':', res.rows.map(r => r.column_name).join(', '));
    }
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);