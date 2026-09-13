require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const r = await p.restaurant.findFirst({
    select: { id: true, slug: true, name: true, ownerId: true }
  });
  console.log('Restaurant:', r);
  if (r) {
    const settings = await p.setting.findUnique({ where: { restaurantId: r.id } });
    console.log('Settings:', settings);
  }
}

main().catch(console.error).finally(() => p.$disconnect());