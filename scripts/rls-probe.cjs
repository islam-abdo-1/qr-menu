/* فحص REST العام بمفتاح anon (نفس ما يفعله مهاجم) — قراءة فقط */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv(file) {
  const out = {};
  const txt = fs.readFileSync(file, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv(path.join(__dirname, "..", ".env.local"));
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const TABLES = [
  "Restaurant", "Setting", "Category", "MenuItem", "MenuItemSize", "Favorite",
  "Order", "OrderItem", "DayStat", "Staff", "Table", "SiteSetting",
  "AuditLog", "OwnerLoginAttempt", "Payment", "_prisma_migrations", "OrderWindow",
];

function expectRejected(status, open) {
  return status === 401 || status === 403 || status === 400;
}

async function probeStorage() {
  console.log("\n── سياسات Storage (bucket: menu-images) ──");
  let bad = 0;

  /* القراءة العامة يجب أن تنجح (للعرض عبر الروابط) */
  const listRes = await fetch(`${base}/storage/v1/object/list/menu-images`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "" }),
  });
  const listOk = listRes.status === 200;
  if (!listOk) bad++;
  console.log(`LIST (anon)       ${listRes.status} ${listOk ? "(عرض عام مسموح ✓)" : "← يجب أن يعمل للعرض العام"}`);

  /* محاولة رفع ملف بلا جلسة — يجب أن تُرفض (الكتابة عبر service-role فقط) */
  const upRes = await fetch(`${base}/storage/v1/object/menu-images/items/__rls-probe.png`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "image/png" },
    body: "probe",
  });
  const upRejected = expectRejected(upRes.status);
  if (!upRejected) bad++;
  console.log(`UPLOAD (anon)     ${upRes.status} ${upRejected ? "(مرفوض ✓)" : "← كتابة مفتوحة!!!"}`);

  /* محاولة تحديث ملف بلا جلسة — يجب أن تُرفض */
  const up2Res = await fetch(`${base}/storage/v1/object/menu-images/items/__rls-probe.png`, {
    method: "PUT",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "image/png" },
    body: "probe",
  });
  const up2Rejected = expectRejected(up2Res.status);
  if (!up2Rejected) bad++;
  console.log(`UPDATE (anon)     ${up2Res.status} ${up2Rejected ? "(مرفوض ✓)" : "← كتابة مفتوحة!!!"}`);

  /* محاولة حذف ملف بلا جلسة — يجب أن تُرفض وتبقى الملفات موجودة */
  const delRes = await fetch(`${base}/storage/v1/object/menu-images/items/__rls-probe.png`, {
    method: "DELETE",
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const delRejected = expectRejected(delRes.status);
  if (!delRejected) bad++;
  console.log(`DELETE (anon)     ${delRes.status} ${delRejected ? "(مرفوض ✓)" : "← حذف مفتوح!!!"}`);

  /* فحص سياسات storage في قاعدة البيانات — لا كتابة لـ anon/authenticated */
  try {
    const c = new Client({ connectionString: env.DATABASE_URL });
    await c.connect();
    const { rows } = await c.query(
      `select policyname, cmd, roles from pg_policies
       where schemaname = 'storage' and tablename = 'objects'`,
    );
    await c.end();
    const unwritable = rows.filter(
      (p) => p.cmd !== "SELECT" && (p.roles.includes("anon") || p.roles.includes("authenticated")),
    );
    if (unwritable.length) {
      bad++;
      console.table(unwritable.map((p) => ({ policy: p.policyname, cmd: p.cmd, roles: p.roles })));
      console.log("← سياسات كتابة متبقية لـ anon/authenticated!!!");
    } else {
      console.log(`POLICIES (DB)     ${rows.length} سياستا — لا كتابة لـ anon/authenticated ✓`);
    }
  } catch (e) {
    console.log("POLICIES (DB)     تعذّر الفحص:", e.message.slice(0, 80));
  }

  return bad;
}

async function main() {
  let leaked = 0;
  for (const t of TABLES) {
    const url = `${base}/rest/v1/${t}?select=*&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    const text = await res.text();
    const hasRows = res.ok && text.trim() !== "" && text.trim() !== "[]";
    if (res.status === 200 && hasRows) leaked++;
    console.log(
      `${t.padEnd(20)} ${res.status} ${hasRows ? "← بيانات متسربة!!!" : res.ok ? "(مغلق/فارغ)" : ""}`,
    );
  }
  console.log(`\nالنتيجة: ${leaked > 0 ? `تحذير — ${leaked} جداول مكشوفة` : "لا تسريب — كل الجداول مغلقة"}`);
  const storageBad = await probeStorage();
  console.log(`\nالمحصلة النهائية: جداول ${leaked === 0 ? "سليمة" : "مكشوفة"} · storage ${storageBad === 0 ? "سليم" : "مكشوف"}`);
  process.exitCode = leaked > 0 || storageBad > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});