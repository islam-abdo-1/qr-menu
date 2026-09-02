require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const r = await p.restaurant.findMany({
    select: { id: true, slug: true, name: true, ownerId: true }
  });
  console.log('Restaurants:', r);
}

main().catch(console.error).finally(() => p.$disconnect());