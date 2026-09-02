/**
 * اختبار الحمل والإجهاد (PHASE 6.14/6.15) — قراءة عامة آمنة فقط:
 * GET على مسارات عامة (لا كتابة، لا جلسات، لا تأثير على بيانات حقيقية).
 * منحنيات: 10 → 25 → 50 → 100 → 200 مستخدم متزامن، ثم نقطة الانهيار 300/500.
 * التشغيل: node scripts/load-test.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";
const TARGETS = ["/m/demo", "/"];
const LEVELS = [
  { ccu: 10, durationMs: 6000 },
  { ccu: 25, durationMs: 6000 },
  { ccu: 50, durationMs: 6000 },
  { ccu: 100, durationMs: 8000 },
  { ccu: 200, durationMs: 8000 },
];
const STRESS = [
  { ccu: 300, durationMs: 8000 },
  { ccu: 500, durationMs: 8000 },
];

const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function worker(ccu, durationMs, report) {
  const jobs = Array.from({ length: ccu }, async () => {
    let i = 0;
    const deadline = Date.now() + durationMs;
    while (Date.now() < deadline) {
      const url = BASE + TARGETS[i++ % TARGETS.length];
      const t0 = performance.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        report.latencies.push(performance.now() - t0);
        if (!res.ok) report.bad.push({ code: res.status, url });
      } catch (e) {
        report.latencies.push(performance.now() - t0);
        report.errors.push(e.name || String(e));
      }
    }
  });
  await Promise.all(jobs);
}

function summary(report, label) {
  const n = report.latencies.length;
  const ok = n - report.errors.length;
  console.log(`\n== ${label} ==`);
  if (!n) {
    console.log("  0 طلبات منجزة — الهدف غير متاح");
    return;
  }
  console.log(`  طلبات: ${n}  |  ناجحة: ${ok}  |  أخطاء شبكة: ${report.errors.length}  |  HTTP غير 2xx: ${report.bad.length}`);
  console.log(
    `  p50=${percentile(report.latencies, 50).toFixed(0)}ms  p95=${percentile(report.latencies, 95).toFixed(0)}ms  p99=${percentile(report.latencies, 99).toFixed(0)}ms  max=${Math.max(...report.latencies).toFixed(0)}ms`,
  );
  if (report.errors.length) {
    const top = {};
    for (const e of report.errors) top[e] = (top[e] || 0) + 1;
    console.log("  أنواع الأخطاء:", JSON.stringify(top));
  }
}

async function main() {
  const alive = await fetch(BASE, { method: "HEAD", signal: AbortSignal.timeout(5000) })
    .then(() => true)
    .catch(() => false);
  if (!alive) {
    console.error(`✗ الخادم غير متاح: ${BASE}`);
    process.exitCode = 1;
    return;
  }
  console.log(`الهدف: ${BASE}`);
  const results = [];
  for (const { ccu, durationMs } of [...LEVELS, ...STRESS]) {
    const report = { latencies: [], errors: [], bad: [] };
    await worker(ccu, durationMs, report);
    summary(report, `حمل ${ccu} مستخدم متزامن (${durationMs / 1000}s)`);
    const errRate = report.latencies.length ? report.errors.length / report.latencies.length : 1;
    results.push({ ccu, errRate, p99: percentile(report.latencies, 99) });
  }
  const broken = results.filter((r) => r.errRate > 0.05 || r.p99 > 10000);
  console.log("\n" + (broken.length ? `⚠ نقطة التدهور: ${broken[0].ccu} CCU (errRate=${(broken[0].errRate * 100).toFixed(1)}%, p99=${broken[0].p99.toFixed(0)}ms)` : "✓ لا تدهور خطير حتى 500 CCU على مسارات القراءة العامة"));
}

main().catch((e) => {
  console.error("✗ خطأ تشغيلي:", e.message);
  process.exitCode = 1;
});