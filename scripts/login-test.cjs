require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch').default;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Sign in with password
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@qr-menu.dev',
    password: 'TestPassword123!'
  });
  
  if (error) {
    console.log('Sign in error:', error);
    return;
  }
  
  console.log('Session:', data.session);
  
  if (data.session) {
    // Now test the API with this session
    const cookie = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`;
    
    console.log('\nCookie:', cookie);
    
    // Test upload
    const fs = require('fs');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('files', fs.createReadStream('C:\\Users\\islam\\OneDrive\\Desktop\\QR\\imeg\\1124140757051928227.jpg'));
    
    const res = await fetch('http://localhost:3000/api/ai-menu/upload', {
      method: 'POST',
      headers: { 'Cookie': cookie },
      body: form
    });
    const result = await res.json();
    console.log('\n=== UPLOAD ===');
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (result.jobId) {
      // Test analyze
      const analyzeRes = await fetch('http://localhost:3000/api/ai-menu/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({ jobId: result.jobId })
      });
      const analyzeText = await analyzeRes.text();
      console.log('\n=== ANALYZE ===');
      console.log('Status:', analyzeRes.status);
      console.log('Response text:', analyzeText.substring(0, 500));
      try {
        const analyzeData = JSON.parse(analyzeText);
        console.log('Response JSON:', JSON.stringify(analyzeData, null, 2));
      } catch(e) {
        console.log('Failed to parse JSON:', e.message);
      }
    }
  }
}

main().catch(console.error);