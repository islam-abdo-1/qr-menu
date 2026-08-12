/* فحص REST العام بمفتاح anon (نفس ما يفعله مهاجم) — قراءة فقط */
const fs = require("fs");
const path = require("path");

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
  "AuditLog", "OwnerLoginAttempt", "Payment", "_prisma_migrations",
];

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
  process.exitCode = leaked > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});