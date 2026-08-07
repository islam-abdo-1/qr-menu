const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const upd = await p.order.updateMany({
    where: { status: "done", completedAt: null },
    data: { completedAt: new Date() },
  });
  console.log("backfilled:", upd.count);
  await p.$disconnect();
})().catch((e) => { console.error("ERR", e.message.split("\n")[0]); process.exit(1); });
