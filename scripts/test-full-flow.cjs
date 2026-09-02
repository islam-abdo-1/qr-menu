require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch').default;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE = 'http://localhost:3000';

async function main() {
  // Sign in
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@qr-menu.dev',
    password: 'TestPassword123!'
  });
  
  if (error) {
    console.log('Sign in error:', error);
    return;
  }
  
  const session = data.session;
  const cookie = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
  
  console.log('Session created');
  
  // Upload
  const fs = require('fs');
  const FormData = require('form-data');
  const form = new FormData();
  form.append('files', fs.createReadStream('C:\\Users\\islam\\OneDrive\\Desktop\\QR\\imeg\\1124140757051928227.jpg'));
  
  let res = await fetch(`${BASE}/api/ai-menu/upload`, {
    method: 'POST',
    headers: { 'Cookie': cookie },
    body: form
  });
  let result = await res.json();
  console.log('\n=== UPLOAD ===');
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(result, null, 2));
  
  if (!result.ok || !result.jobId) {
    console.log('Upload failed');
    return;
  }
  
  const jobId = result.jobId;
  
  // Analyze
  res = await fetch(`${BASE}/api/ai-menu/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ jobId })
  });
  result = await res.json();
  console.log('\n=== ANALYZE ===');
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(result, null, 2));
  
  if (!result.ok) {
    console.log('Analyze failed');
    return;
  }
  
  // Get job details
  res = await fetch(`${BASE}/api/ai-menu/jobs/${jobId}`, {
    headers: { 'Cookie': cookie }
  });
  result = await res.json();
  console.log('\n=== JOB DETAILS ===');
  console.log('Status:', res.status);
  console.log('Items:', result.items?.length);
  if (result.items) {
    result.items.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.name} - ${item.price} ${item.currency} (${item.categoryName})`);
    });
  }
  
  // Import
  console.log('\n=== IMPORT ===');
  res = await fetch(`${BASE}/api/ai-menu/jobs/${jobId}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: JSON.stringify({ confirm: true })
  });
  result = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(result, null, 2));
}

main().catch(console.error);