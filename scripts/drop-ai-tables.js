require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function dropTables() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    await client.query('DROP TABLE IF EXISTS "AiMenuImportItem";');
    console.log('Dropped AiMenuImportItem');
    
    await client.query('DROP TABLE IF EXISTS "AiMenuImportJob";');
    console.log('Dropped AiMenuImportJob');
    
    await client.query('DROP TABLE IF EXISTS "AiMenuStyleReference";');
    console.log('Dropped AiMenuStyleReference');
    
    await client.query('DROP TABLE IF EXISTS "AiMenuStyle";');
    console.log('Dropped AiMenuStyle');
    
    await client.query('DROP TABLE IF EXISTS "AiUsageLog";');
    console.log('Dropped AiUsageLog');
    
    await client.end();
    console.log('All AI tables dropped successfully');
  } catch (e) {
    console.error('Error dropping tables:', e.message);
    process.exit(1);
  }
}

dropTables();