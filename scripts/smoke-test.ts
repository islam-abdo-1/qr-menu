import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DIRECT_URL, max: 1 });

const BASE = 'https://qr-menu-79a45lrgk-islam230366qw-bots-projects.vercel.app';

async function httpGet(path) {
  const res = await fetch(`${BASE}${path}`, { 
    method: 'GET',
    headers: { 'User-Agent': 'smoke-test/1.0' }
  });
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text: await res.text() };
}

async function httpPost(path, body) {
  const res = await fetch(`${BASE}${path}`, { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'smoke-test/1.0' },
    body: JSON.stringify(body)
  });
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), text: await res.text() };
}

async function run() {
  console.log('🔬 Starting smoke tests...\n');
  
  // D1: Health Check
  console.log('D1: Health Check');
  const health = await httpGet('/api/health');
  console.log(`  GET /api/health → ${health.status} ${health.status === 200 ? '✅' : '❌'}`);
  
  // D2: Menu Page (ISR) - using kafy slug
  console.log('\nD2: Menu Page (ISR)');
  const menu = await httpGet('/m/kafy');
  console.log(`  GET /m/kafy → ${menu.status} ${menu.status === 200 ? '✅' : '❌'}`);
  if (menu.status === 200) {
    const hasHtml = menu.text.includes('<html') || menu.text.includes('<!DOCTYPE');
    console.log(`  HTML valid: ${hasHtml ? '✅' : '❌'}`);
  }
  
  // D3: Rate Limiting - Order creation (30 req/min)
  console.log('\nD3: Rate Limiting (Order API)');
  let rateLimited = false;
  for (let i = 0; i < 35; i++) {
    const r = await httpPost('/api/orders', {
      type: 'dine-in',
      customerName: `Test ${i}`,
      tableNo: '1',
      items: [{ itemId: 'test', sizeCode: 'M', price: 50, qty: 1 }],
      total: 50,
      cartNonce: `test-${Date.now()}-${i}`
    });
    if (r.status === 429) {
      rateLimited = true;
      console.log(`  Request ${i+1}: 429 (rate limited) ✅`);
      console.log(`  Retry-After: ${r.headers['retry-after'] || 'N/A'}`);
      break;
    }
  }
  if (!rateLimited) console.log(`  ⚠️  Rate limit not triggered after 35 requests`);
  
  // D4: Security Headers
  console.log('\nD4: Security Headers');
  const home = await httpGet('/');
  const requiredHeaders = [
    'content-security-policy',
    'strict-transport-security',
    'x-frame-options',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy'
  ];
  requiredHeaders.forEach(h => {
    const val = home.headers[h];
    console.log(`  ${h}: ${val ? '✅' : '❌'}`);
  });
  
  // D5: Circuit Breaker header
  console.log('\nD5: Circuit Breaker Header');
  console.log(`  x-circuit-breaker: ${home.headers['x-circuit-breaker'] || '❌ missing'}`);
  
  // D6: Rate Limiting - Menu pages (300 req/min per IP per restaurant)
  console.log('\nD6: Rate Limiting (Menu pages)');
  let menuLimited = false;
  for (let i = 0; i < 305; i++) {
    const r = await httpGet('/m/kafy');
    if (r.status === 429) {
      menuLimited = true;
      console.log(`  Request ${i+1}: 429 (rate limited) ✅`);
      break;
    }
  }
  if (!menuLimited) console.log(`  ⚠️  Menu rate limit not triggered after 305 requests (may be per Edge instance)`);
  
  // D7: RLS Isolation Test (via API)
  console.log('\nD7: RLS Isolation (via API endpoints)');
  const admin = await httpGet('/api/admin/export-customers');
  console.log(`  GET /api/admin/export-customers (no auth) → ${admin.status} ${admin.status === 401 || admin.status === 307 || admin.status === 302 ? '✅ (protected)' : '❌'}`);
  
  // D8: Login page loads
  console.log('\nD8: Login Page');
  const login = await httpGet('/login');
  console.log(`  GET /login → ${login.status} ${login.status === 200 ? '✅' : '❌'}`);
  
  // D9: Turnstile script loads (check CSP allows it)
  console.log('\nD9: CSP allows Turnstile/GA');
  const csp = home.headers['content-security-policy'] || '';
  const allowsTurnstile = csp.includes('challenges.cloudflare.com');
  const allowsGA = csp.includes('googletagmanager.com') || csp.includes('google-analytics.com');
  console.log(`  challenges.cloudflare.com: ${allowsTurnstile ? '✅' : '❌'}`);
  console.log(`  google-analytics.com: ${allowsGA ? '✅' : '❌'}`);
  
  console.log('\n✅ Smoke tests complete!');
  await pool.end();
}
run().catch(console.error);