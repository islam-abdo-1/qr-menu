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
process.env.DATABASE_URL = env.DATABASE_URL;
process.env.DIRECT_URL = env.DIRECT_URL;

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "menu-images";

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = path.join(__dirname, "..", "backup", `backup-${stamp}`);
const imagesDir = path.join(backupDir, "images");

const authHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

async function listPrefix(prefix) {
  let all = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset }),
    });
    if (!res.ok) throw new Error(`list ${prefix} failed: ${res.status}`);
    const arr = await res.json();
    const files = (arr || []).filter((o) => o.id).map((o) => ({ ...o, name: prefix + o.name }));
    all = all.concat(files);
    if (!files || files.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function downloadObject(objectPath, destPath) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    headers: authHeaders,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`download ${objectPath} failed: ${res.status} :: ${body.slice(0, 200)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

(async () => {
  const report = { exportedAt: new Date().toISOString(), counts: {}, images: [] };

  // 1) DB dump
  const settings = await prisma.setting.findMany({ orderBy: { id: "asc" } });
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const items = await prisma.menuItem.findMany({ orderBy: { createdAt: "asc" } });
  report.counts.settings = settings.length;
  report.counts.categories = categories.length;
  report.counts.items = items.length;

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(
    path.join(backupDir, "data.json"),
    JSON.stringify({ ...report, settings, categories, items }, null, 2),
  );

  // 2) images download
  const prefixes = ["items/", "logo/"];
  const allFiles = [];
  for (const p of prefixes) allFiles.push(...(await listPrefix(p)));

  let totalBytes = 0;
  for (const f of allFiles) {
    const dest = path.join(imagesDir, f.name.replace(/\//g, path.sep));
    const bytes = await downloadObject(f.name, dest);
    report.images.push({ name: f.name, bytes, expected: Number(f.metadata && f.metadata.size) || 0 });
    totalBytes += bytes;
  }
  report.totalImageBytes = totalBytes;

  // 3) verification: re-read and compare
  const verify = JSON.parse(fs.readFileSync(path.join(backupDir, "data.json"), "utf8"));
  const errors = [];
  if (verify.counts.settings !== report.counts.settings) errors.push("settings count mismatch");
  if (verify.counts.categories !== report.counts.categories) errors.push("categories count mismatch");
  if (verify.counts.items !== report.counts.items) errors.push("items count mismatch");
  if (report.images.length !== allFiles.length) errors.push("images count mismatch");
  for (const img of report.images) {
    if (!fs.existsSync(path.join(imagesDir, img.name.replace(/\//g, path.sep)))) errors.push(`missing file ${img.name}`);
    if (img.bytes === 0) errors.push(`empty file ${img.name}`);
    if (img.expected && img.bytes !== img.expected) errors.push(`size mismatch ${img.name}`);
  }

  console.log("BACKUP DIR:", backupDir);
  console.log("counts:", JSON.stringify(report.counts));
  console.log("images:", report.images.length, "| total:", Math.round(totalBytes / 1024), "KB");
  if (errors.length) {
    console.error("VERIFY FAILED:", errors.join("; "));
    process.exit(1);
  }
  console.log("BACKUP OK - verified");
  await prisma.$disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error("BACKUP ERROR:", e.message);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
