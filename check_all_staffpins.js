const {Client} = require("pg");
const c = new Client({connectionString: "postgresql://postgres:QR_MENU_2303AN@db.chczpvevpfqiyvfwjbro.supabase.co:5432/postgres?connection_limit=2"});
c.connect().then(() => c.query("SELECT slug, name, \"staffPin\" FROM \"Restaurant\""))
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); return c.end(); })
  .catch(e => console.error(e.message));