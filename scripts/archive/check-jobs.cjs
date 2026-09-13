require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const jobs = await p.aiMenuImportJob.findMany({
    where: { restaurantId: 'ee49eb3b-c600-4eb5-a370-bdd4a624af47' },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  console.log('Recent jobs:', jobs.map(j => ({ id: j.id, status: j.status, createdAt: j.createdAt })));
}

main().catch(console.error).finally(() => p.$disconnect());