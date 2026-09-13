require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const restaurantId = 'ee49eb3b-c600-4eb5-a370-bdd4a624af47';
  
  // Check categories
  const categories = await p.category.findMany({
    where: { restaurantId },
    include: {
      items: {
        select: { name: true, price: true, imageUrl: true }
      }
    }
  });
  
  console.log('Categories:', categories.length);
  categories.forEach(cat => {
    console.log(`\n${cat.name} (${cat.items.length} items):`);
    cat.items.forEach(item => {
      console.log(`  - ${item.name}: ${item.price} EGP ${item.imageUrl ? '✅ image' : '❌ no image'}`);
    });
  });
  
  // Check AI jobs
  const jobs = await p.aiMenuImportJob.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('\nRecent AI Jobs:', jobs.map(j => ({ id: j.id, status: j.status, items: j.detectedItemCount, images: j.generatedImageCount })));
}

main().catch(console.error).finally(() => p.$disconnect());