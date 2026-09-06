/**
 * Polling Load Test for 15 Restaurants
 * 
 * يحاكي: 15 مطعم × (1 Staff + 1 Admin) = 30 polling clients
 * Staff polling: كل 10 ثوانٍ
 * Admin polling: كل 20 ثانية
 * المجموع: 3 req/sec baseline، peaks عند 6 req/sec (sync)
 * 
 * التشغيل: node scripts/polling-load-test.mjs [baseUrl] [durationMinutes]
 */

const BASE = process.argv[2] || 'https://site-menu.ddnsfree.com';
const DURATION_MIN = parseInt(process.argv[3]) || 5;

const RESTAURANT_COUNT = 15;
const RESTAURANTS = Array.from({ length: RESTAURANT_COUNT }, (_, i) => `rest-${String(i + 1).padStart(2, '0')}`);

const POLL_INTERVALS = {
  staff: 10000,   // 10 seconds
  admin: 20000,   // 20 seconds
};

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

class Poller {
  constructor({ name, restaurant, type, interval, cookie }) {
    this.name = name;
    this.restaurant = restaurant;
    this.type = type; // 'staff' or 'admin'
    this.interval = interval;
    this.cookie = cookie;
    this.results = [];
    this.running = false;
    this.requestCount = 0;
    this.errorCount = 0;
  }

  async poll() {
    const t0 = performance.now();
    this.requestCount++;
    
    let url, options = { headers: {} };
    
    if (this.type === 'staff') {
      url = `${BASE}/api/staff/orders?slug=${this.restaurant}`;
      if (this.cookie) options.headers.Cookie = this.cookie;
    } else {
      url = `${BASE}/api/admin/orders`;
      // Admin uses session cookies
    }
    
    try {
      const res = await fetchWithTimeout(url, options, 10000);
      const latency = performance.now() - t0;
      
      const ok = res.ok || (this.type === 'admin' && [401, 302, 307].includes(res.status));
      
      this.results.push({
        timestamp: Date.now(),
        latency,
        ok,
        status: res.status,
      });
      
      if (!ok) this.errorCount++;
      
      return { ok, latency, status: res.status };
    } catch (e) {
      const latency = performance.now() - t0;
      this.results.push({
        timestamp: Date.now(),
        latency,
        ok: false,
        error: e.name || e.message,
      });
      this.errorCount++;
      return { ok: false, latency, error: e.message };
    }
  }

  async run(durationMs) {
    this.running = true;
    const deadline = Date.now() + durationMs;
    
    // Initial poll
    await this.poll();
    
    while (this.running && Date.now() < deadline) {
      await sleep(this.interval);
      if (!this.running) break;
      await this.poll();
    }
    
    this.running = false;
  }

  stop() {
    this.running = false;
  }

  getStats() {
    const latencies = this.results.filter(r => r.ok).map(r => r.latency);
    const errors = this.results.filter(r => !r.ok);
    
    return {
      name: this.name,
      type: this.type,
      restaurant: this.restaurant,
      totalRequests: this.requestCount,
      successful: this.requestCount - this.errorCount,
      errors: this.errorCount,
      errorRate: this.requestCount ? this.errorCount / this.requestCount : 0,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies.length ? Math.max(...latencies) : 0,
      avgLatency: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    };
  }
}

async function loginStaff(restaurant) {
  try {
    const res = await fetchWithTimeout(`${BASE}/api/staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'staff', pin: '1234', slug: restaurant }),
    }, 5000);
    
    if (res.ok) {
      return res.headers.get('set-cookie');
    }
  } catch (e) {
    console.log(`  ⚠️  Staff login failed for ${restaurant}: ${e.message}`);
  }
  return null;
}

async function runPollingTest() {
  console.log('🔄 QR Menu - Polling Load Test (15 Restaurants)');
  console.log(`Target: ${BASE}`);
  console.log(`Duration: ${DURATION_MIN} minutes`);
  console.log(`Restaurants: ${RESTAURANT_COUNT}`);
  console.log(`Total Pollers: ${RESTAURANT_COUNT * 2} (${RESTAURANT_COUNT} staff + ${RESTAURANT_COUNT} admin)`);
  console.log(`Expected RPS: ~${(RESTAURANT_COUNT / 10 + RESTAURANT_COUNT / 20).toFixed(1)} req/sec\n`);
  
  // Login staff for each restaurant
  console.log('🔐 Logging in staff for all restaurants...');
  const staffCookies = {};
  for (const r of RESTAURANTS) {
    const cookie = await loginStaff(r);
    if (cookie) staffCookies[r] = cookie;
  }
  console.log(`✓ Logged in to ${Object.keys(staffCookies).length}/${RESTAURANT_COUNT} restaurants\n`);
  
  // Create pollers
  const pollers = [];
  
  for (const r of RESTAURANTS) {
    // Staff poller
    pollers.push(new Poller({
      name: `staff-${r}`,
      restaurant: r,
      type: 'staff',
      interval: POLL_INTERVALS.staff,
      cookie: staffCookies[r] || null,
    }));
    
    // Admin poller
    pollers.push(new Poller({
      name: `admin-${r}`,
      restaurant: r,
      type: 'admin',
      interval: POLL_INTERVALS.admin,
      cookie: null,
    }));
  }
  
  console.log(`▶️  Starting ${pollers.length} pollers for ${DURATION_MIN} minutes...\n`);
  
  // Run all pollers concurrently
  const durationMs = DURATION_MIN * 60 * 1000;
  await Promise.all(pollers.map(p => p.run(durationMs)));
  
  // Collect stats
  console.log('\n' + '='.repeat(80));
  console.log('📊 POLLING TEST RESULTS');
  console.log('='.repeat(80));
  
  const byType = { staff: [], admin: [] };
  
  for (const p of pollers) {
    const stats = p.getStats();
    byType[stats.type].push(stats);
    
    const status = stats.errorRate <= 0.05 && stats.p99 <= 2000 ? '✅' : '⚠️';
    console.log(`${status} ${stats.name}: ${stats.successful}/${stats.totalRequests} ok | p50=${stats.p50.toFixed(0)}ms p95=${stats.p95.toFixed(0)}ms p99=${stats.p99.toFixed(0)}ms | err=${(stats.errorRate * 100).toFixed(1)}%`);
  }
  
  // Summary by type
  for (const type of ['staff', 'admin']) {
    const polls = byType[type];
    const allLatencies = polls.flatMap(p => p.results.filter(r => r.ok).map(r => r.latency));
    const totalReq = polls.reduce((a, b) => a + b.totalRequests, 0);
    const totalErr = polls.reduce((a, b) => a + b.errors, 0);
    const avgP99 = percentile(allLatencies, 99);
    
    console.log(`\n--- ${type.toUpperCase()} Summary (${polls.length} pollers) ---`);
    console.log(`  Total Requests: ${totalReq}`);
    console.log(`  Error Rate: ${((totalErr / totalReq) * 100).toFixed(1)}%`);
    console.log(`  p99 Latency: ${avgP99.toFixed(0)}ms`);
    console.log(`  Expected Interval: ${POLL_INTERVALS[type] / 1000}s`);
    console.log(`  Actual Avg Interval: ${(durationMs / (totalReq / polls.length)).toFixed(0)}ms per poller`);
  }
  
  // Check for sync spikes (when staff and admin poll at same time)
  console.log('\n--- Sync Spike Analysis ---');
  const allResults = pollers.flatMap(p => p.results.map(r => ({ ...r, poller: p.name })));
  const bySecond = {};
  
  for (const r of allResults) {
    const sec = Math.floor(r.timestamp / 1000);
    if (!bySecond[sec]) bySecond[sec] = 0;
    bySecond[sec]++;
  }
  
  const rpsValues = Object.values(bySecond);
  const maxRps = Math.max(...rpsValues);
  const avgRps = rpsValues.reduce((a, b) => a + b, 0) / rpsValues.length;
  
  console.log(`  Max RPS (any second): ${maxRps}`);
  console.log(`  Average RPS: ${avgRps.toFixed(1)}`);
  console.log(`  Theoretical Peak (all sync): ${pollers.length}`);
  
  if (maxRps > pollers.length * 0.5) {
    console.log('  ⚠️  High sync detected - consider jitter in polling intervals');
  }
  
  // SLA Check
  console.log('\n--- SLA Compliance ---');
  const slaPass = [];
  const slaFail = [];
  
  for (const p of pollers) {
    const stats = p.getStats();
    const pass = stats.errorRate <= 0.05 && stats.p99 <= 2000;
    (pass ? slaPass : slaFail).push(stats.name);
  }
  
  console.log(`  ✅ Pass: ${slaPass.length}/${pollers.length}`);
  console.log(`  ❌ Fail: ${slaFail.length}/${pollers.length}`);
  
  if (slaFail.length > 0) {
    console.log('\n  Failed pollers:');
    for (const name of slaFail) {
      const p = pollers.find(p => p.name === name);
      const s = p.getStats();
      console.log(`    - ${name}: err=${(s.errorRate * 100).toFixed(1)}% p99=${s.p99.toFixed(0)}ms`);
    }
  }
  
  return { pollers, byType, bySecond };
}

// Quick health check first
async function checkHealth() {
  try {
    const res = await fetchWithTimeout(`${BASE}/api/health`, { method: 'HEAD' }, 5000);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const healthy = await checkHealth();
  if (!healthy) {
    console.error(`✗ Server not reachable: ${BASE}`);
    process.exitCode = 1;
    return;
  }
  
  await runPollingTest();
}

main().catch(e => {
  console.error('✗ Fatal error:', e);
  process.exitCode = 1;
});