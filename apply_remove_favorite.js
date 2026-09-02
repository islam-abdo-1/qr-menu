const {Client} = require("pg");
const c = new Client({connectionString: "postgresql://postgres:QR_MENU_2303AN@db.chczpvevpfqiyvfwjbro.supabase.co:5432/postgres?connection_limit=2"});

const sql = `
DROP TABLE IF EXISTS "Favorite" CASCADE;
`;

c.connect().then(() => c.query(sql))
  .then(r => { console.log("Favorite table dropped successfully"); return c.end(); })
  .catch(e => console.error(e.message));