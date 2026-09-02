require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Add imageBlurDataURL to MenuItem
    await client.query('ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "imageBlurDataURL" TEXT;');
    console.log('Added imageBlurDataURL to MenuItem');
    
    // Add blurDataURL to finalImageMeta in AiMenuImportItem (already JSON, no schema change needed)
    console.log('AiMenuImportItem uses JSON for finalImageMeta - no schema change needed');
    
    await client.end();
    console.log('Migration complete');
  } catch (e) {
    console.error('Migration error:', e.message);
    process.exit(1);
  }
}

runMigration();