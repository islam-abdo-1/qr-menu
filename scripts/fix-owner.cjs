require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Update restaurant ownerId to match the test user
  const userId = '67b846ea-31ff-4a44-aee4-3cc7579970f5'; // test@qr-menu.dev
  const r = await p.restaurant.update({
    where: { id: 'ee49eb3b-c600-4eb5-a370-bdd4a624af47' },
    data: { ownerId: userId }
  });
  console.log('Updated restaurant:', r);
}

main().catch(console.error).finally(() => p.$disconnect());