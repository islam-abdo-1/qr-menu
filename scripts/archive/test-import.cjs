require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch').default;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE = 'http://localhost:3000';

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@qr-menu.dev',
    password: 'TestPassword123!'
  });
  
  if (error) { console.log('Sign in error:', error); return; }
  
  const session = data.session;
  const cookie = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
  
  // Find latest job
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  const job = await p.aiMenuImportJob.findFirst({
    where: { restaurantId: 'ee49eb3b-c600-4eb5-a370-bdd4a624af47' },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!job) { console.log('No job found'); return; }
  console.log('Using job:', job.id);
  
  // Import
  console.log('\n=== IMPORT ===');
  const res = await fetch(`${BASE}/api/ai-menu/jobs/${job.id}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ confirm: true })
  });
  const result = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(result, null, 2));
  
  // Verify
  const cats = await p.category.findMany({
    where: { restaurantId: 'ee49eb3b-c600-4eb5-a370-bdd4a624af47' },
    include: { items: { select: { name: true, price: true, imageUrl: true } } }
  });
  
  console.log('\n=== VERIFICATION ===');
  cats.forEach(cat => {
    if (cat.items.length > 0) {
      console.log(`\n${cat.name} (${cat.items.length} items):`);
      cat.items.forEach(item => {
        console.log(`  - ${item.name}: ${item.price} EGP ${item.imageUrl ? '✅ image' : '❌ no image'}`);
      });
    }
  });
}

main().catch(console.error);