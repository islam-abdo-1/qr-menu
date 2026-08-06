const fs = require("fs");
const file = ".env.local";
const RAW = fs.readFileSync(file, "utf8");
function get(k) {
  const m = RAW.split(/\r?\n/).find((l) => l.startsWith(k + "="));
  if (!m) return null;
  let v = m.slice(k.length + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}
const url = get("NEXT_PUBLIC_SUPABASE_URL") || "";
const refUrl = url.match(/https:\/\/([^.]+)\.supabase\.co/);
const refDb = get("DATABASE_URL") || "";
const dbHost = refDb.replace(/^[a-z+]+:\/\//, "").split(/[@/]/).pop().split(":")[0];
const refDbInfo = db.startsWith(" ") ? "(parse ok)" : db;
console.log("Auth project ref:", refUrl ? refUrl[1] : "UNKNOWN");
console.log("DATABASE_URL host:", dbHost);
console.log("DIRECT_URL ref:", (get("DIRECT_URL") || "").match(/[a-z0-9]{20,}\.pooler\.supabase\.com/)?.[0]?.split(".")[0] || "n/a");