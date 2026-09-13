const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch').default;

const BASE = 'http://localhost:3000';

// Test 1: Upload image
async function testUpload() {
  const form = new FormData();
  form.append('files', fs.createReadStream('C:\\Users\\islam\\OneDrive\\Desktop\\QR\\imeg\\1124140757051928227.jpg'));
  
  try {
    const res = await fetch(`${BASE}/api/ai-menu/upload`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    console.log('=== UPLOAD ===');
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    return data.jobId;
  } catch(e) {
    console.log('Upload error:', e.message);
  }
}

// Test 2: Analyze
async function testAnalyze(jobId) {
  try {
    const res = await fetch(`${BASE}/api/ai-menu/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    const data = await res.json();
    console.log('\n=== ANALYZE ===');
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
  } catch(e) {
    console.log('Analyze error:', e.message);
  }
}

// Test 3: Get job details
async function testJob(jobId) {
  try {
    const res = await fetch(`${BASE}/api/ai-menu/jobs/${jobId}`);
    const data = await res.json();
    console.log('\n=== JOB DETAILS ===');
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
  } catch(e) {
    console.log('Job error:', e.message);
  }
}

async function main() {
  const jobId = await testUpload();
  if (!jobId) return;
  
  await testAnalyze(jobId);
  
  // Wait a bit then check job
  await new Promise(r => setTimeout(r, 2000));
  await testJob(jobId);
}

main().catch(console.error);