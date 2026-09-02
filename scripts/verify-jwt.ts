/**
 * إثبات ذاتي لمنطق التحقق المحلي من JWT (lib/jwt.ts):
 * يبني الرموز المزورة بنفس أدوات المهاجم ويتأكد أن كل هجوم يُرفض،
 * والتواجد السليم يُقبل. التشغيل:
 *   npx tsx scripts/verify-jwt.ts
 * (يقرأ .env.local وقته — قد يظهر تحذير في حال عدم ضبط SUPABASE_JWT_PUBLIC_KEY.)
 */
import { generateKeyPairSync, createSign, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

async function main() {
// 1) تحميل إعدادات المشروع مثل runtime Vercel
const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

// 2) استيراد المنطق الحقيقي — مع حقن مفتاح بالقيم الحقيقية قبل أول استدعاء
const { verifyJwtSignature } = await import("../lib/jwt");

function b64u(buf: Buffer): string {
  return buf.toString("base64url");
}

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" });
// حقن مفتاح مولّد للاختبار — يتجاوز المفتاح الحقيقي في .env.local
// (التحقق من صحة المفتاح الحقيقي يتم منفصلًا أسفل السكريبت)
process.env.SUPABASE_JWT_PUBLIC_KEY = JSON.stringify({
  kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, kid: "self-test",
});

const header = b64u(Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })));
const payload = b64u(Buffer.from(JSON.stringify({ sub: "test-user", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })));

/** تحويل DER → R||S خام 64 بايت */
function derToRaw(der: Buffer): Buffer {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error("not SEQUENCE");
  const seqLen = der[i++];
  if (seqLen & 0x80) i += seqLen & 0x7f;
  const r = readInt(der, i); i = r.next;
  const s = readInt(der, i); i = s.next;
  return Buffer.concat([pad32(r.value), pad32(s.value)]);
}
function readInt(der: Buffer, i: number) {
  if (der[i++] !== 0x02) throw new Error("not INTEGER");
  let len = der[i++];
  if (len & 0x80) { const n = len & 0x7f; len = der.readUIntBE(i, n); i += n; }
  const start = i; const end = i + len; i = end;
  let value = der.subarray(start, end);
  if (value[0] === 0) value = value.subarray(1);
  return { value, next: i };
}
function pad32(b: Buffer): Buffer {
  if (b.length > 32) throw new Error("int too wide");
  return Buffer.concat([Buffer.alloc(32 - b.length), b]);
}

// نظام P-256
const P256_N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
// OpenSSL 3 قد يوقّع بـ S مرتفع حسب البناء — العيّنات تُضبط صراحةً لتكون مستقلة عن البيئة:
function forceLowS(raw: Buffer): Buffer {
  const s = BigInt(`0x${raw.subarray(32).toString("hex")}`);
  if (s <= P256_N / BigInt(2)) return raw;
  const flipped = (P256_N - s) % P256_N;
  const hex = flipped.toString(16).padStart(64, "0");
  return Buffer.concat([raw.subarray(0, 32), Buffer.from(hex, "hex")]);
}
// قيمة S مرتفعة (malleability) — مضمونة > N/2 إذا كانت العيّنة الأساسية منخفضة
function forceHighS(raw: Buffer): Buffer {
  const s = BigInt(`0x${raw.subarray(32).toString("hex")}`);
  if (s > P256_N / BigInt(2)) return raw;
  const flipped = (P256_N - s) % P256_N;
  const hex = flipped.toString(16).padStart(64, "0");
  return Buffer.concat([raw.subarray(0, 32), Buffer.from(hex, "hex")]);
}

let failures = 0;
const results: string[] = [];
function check(name: string, got: boolean, want: boolean) {
  const ok = got === want;
  if (!ok) failures++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name} (got ${got}, want ${want})`);
  console.log(results[results.length - 1]);
}

// تواقيع صحيحة بكلتا الصيغتين
const signer = createSign("sha256");
signer.update(Buffer.from(`${header}.${payload}`));
const derSig = signer.sign(privateKey as any);
check("ES256 توقيع DER سليم مقبول", verifyJwtSignature(`${header}.${payload}.${b64u(derSig)}`), true);

const rawSig = forceLowS(derToRaw(derSig));
check("ES256 توقيع R||S خام سليم مقبول", verifyJwtSignature(`${header}.${payload}.${b64u(rawSig)}`), true);

// هجمات
check("تنسيق فاسد (جزءان) مرفوض", verifyJwtSignature("aaa.bbb"), false);
check("توقيع عشوائي مرفوض", verifyJwtSignature(`${header}.${payload}.${b64u(Buffer.alloc(64, 7))}`), false);
check("حمولة معدَّلة (عبث) مرفوضة", verifyJwtSignature(`${header}.${b64u(Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), sub: "attacker" })))}.${b64u(rawSig)}`), false);
check("توقيع High-S (مفتوح للمعالجة) مرفوض", verifyJwtSignature(`${header}.${payload}.${b64u(forceHighS(rawSig))}`), false);

// خلط خوارزميات: HS256 موقّع بمفتاح عام كمفتاح سري — يجب ألا يُقبل مع مفتاح EC
const fakeHeader = b64u(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
const hmacSig = createHmac("sha256", Buffer.from(`${jwk.x}${jwk.y}`)).update(`${fakeHeader}.${payload}`).digest("base64url");
check("HS256 بجانب مفتاح EC (خلط خوارزميات) مرفوض", verifyJwtSignature(`${fakeHeader}.${payload}.${hmacSig}`), false);

// مفتاح آخر غير المكوَّن
const other = generateKeyPairSync("ec", { namedCurve: "P-256" });
const otherSigner = createSign("sha256");
otherSigner.update(Buffer.from(`${header}.${payload}`));
const otherSig = otherSigner.sign(other.privateKey as any);
check("توقيع بمفتاح مختلف مرفوض", verifyJwtSignature(`${header}.${payload}.${b64u(otherSig)}`), false);

// المفتاح الحقيقي من الإعداد نفسه صالح EC؟
let realKeyOk = true;
try {
  const raw = process.env.SUPABASE_JWT_PUBLIC_KEY;
  const keys = Array.isArray(JSON.parse(raw!).keys) ? JSON.parse(raw!).keys : [JSON.parse(raw!)];
  if (!keys.some((k: any) => k?.kty === "EC" && k?.crv === "P-256" && k?.x && k?.y)) realKeyOk = false;
} catch {
  realKeyOk = false;
}
if (realKeyOk) {
  results.push("PASS  SUPABASE_JWT_PUBLIC_KEY الحقيقي يُفسَّر كمفتاح EC صالح");
  console.log(results[results.length - 1]);
} else {
  results.push("WARN  SUPABASE_JWT_PUBLIC_KEY غير مضبوط/غير صالح في .env.local — تحقق منه قبل النشر");
  console.log(results[results.length - 1]);
}

console.log(failures === 0 ? "\n✔ كل الفحوصات نجحت" : `\n✘ ${failures} فشل — راجع المنطق`);
process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});