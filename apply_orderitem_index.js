const {Client} = require("pg");
const c = new Client({connectionString: "postgresql://postgres:QR_MENU_2303AN@db.chczpvevpfqiyvfwjbro.supabase.co:5432/postgres?connection_limit=2"});

const sql = `
CREATE INDEX IF NOT EXISTS "OrderItem_itemId_orderId_idx" ON "OrderItem" ("itemId", "orderId");
`;

c.connect().then(() => c.query(sql))
  .then(r => { console.log("Composite index created successfully"); return c.end(); })
  .catch(e => console.error(e.message));