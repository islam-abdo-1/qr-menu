import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tables = [
  'OrderItem', 'Order', 'OrderWindow', 'DayStat', 'MenuItemSize',
  'MenuItem', 'Category', 'Table', 'Staff', 'Setting', 'Restaurant',
  'Payment', 'AuditLog', 'OwnerLoginAttempt', 'SiteSetting', '_prisma_migrations'
];

async function dropAllTables() {
  try {
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`Dropped ${table}`);
      } catch (e) {
        console.log(`Could not drop ${table}:`, e.message);
      }
    }
    console.log('All tables dropped successfully');
  } catch (error) {
    console.error('Error dropping tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

dropAllTables();