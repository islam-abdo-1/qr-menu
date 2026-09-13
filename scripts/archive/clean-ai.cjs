require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.aiMenuImportJob.deleteMany({});
  await p.aiMenuImportItem.deleteMany({});
  console.log('Cleaned AI items & jobs');
  await p.$disconnect();
})();
