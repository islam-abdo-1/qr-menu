require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Delete all ai menu jobs for this restaurant this month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  
  const deleted = await p.aiMenuImportJob.deleteMany({
    where: {
      restaurantId: 'ee49eb3b-c600-4eb5-a370-bdd4a624af47',
      createdAt: { gte: monthStart }
    }
  });
  
  console.log('Deleted jobs:', deleted.count);
  
  // Also delete items
  const deletedItems = await p.aiMenuImportItem.deleteMany({
    where: {
      job: { restaurantId: 'ee49eb3b-c600-4eb5-a370-bdd4a624af47', createdAt: { gte: monthStart } }
    }
  });
  console.log('Deleted items:', deletedItems.count);
}

main().catch(console.error).finally(() => p.$disconnect());