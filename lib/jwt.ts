import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from "crypto";

/**
 * التحقق المحلي من توقيع JWT — مشترك بين لوحة الإدارة وسكريبت الإثبات الذاتي
 * (script يفحص نفس المنطق). لا يستورد server-only حتى يعمل في بيئات الاختبار.
 */

/** المفتاح العام المستخدم لتوقيع التوكنات (الصيغة الجديدة لـ Supabase: ES256/JWK) */
let cachedPublicKey: ReturnType<typeof createPublicKey> | null | undefined;
export function getJwtPublicKey() {
  if (cachedPublicKey !== undefined) return cachedPublicKey;
  cachedPublicKey = null;
  try {
    const raw = process.env.SUPABASE_JWT_PUBLIC_KEY;
    if (!raw) return null;
    const jwks = JSON.parse(raw) as unknown;
    const jwksObj = jwks as { keys?: Array<Record<string, string>> };
    const keys = Array.isArray(jwksObj.keys) ? jwksObj.keys : [jwks as Record<string, string>];
    const jwk = keys.find((k) => k && k.kty === "EC");
    if (!jwk) return null;
    cachedPublicKey = createPublicKey({ key: jwk, format: "jwk" });
  } catch {
    cachedPublicKey = null;
  }
  return cachedPublicKey;
}

/** تحويل توقيع ECDSA (R||S خام) إلى DER — Node يطلب DER */
export function rawEcdsaToDer(raw: Buffer): Buffer {
  const r = BigInt(`0x${raw.subarray(0, 32).toString("hex")}`);
  const s = BigInt(`0x${raw.subarray(32, 64).toString("hex")}`);
  const intBytes = (n: bigint): Buffer => {
    let hex = n.toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    if (/^[89a-f]/i.test(hex)) hex = `00${hex}`;
    return Buffer.from(hex, "hex");
  };
  const rb = intBytes(r);
  const sb = intBytes(s);
  const inner = Buffer.concat([
    Buffer.from([0x02, rb.length]), rb,
    Buffer.from([0x02, sb.length]), sb,
  ]);
  return Buffer.concat([Buffer.from([0x30, inner.length]), inner]);
}

/** نظام منحنى P-256 (N) — لرفض التواقيع ذات S المرتفع (high-S malleable) */
const P256_N = BigInt(
  "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
);

/**
 * تحقق التوقيع من JWT — لا نثق بأي توكن غير موقّع:
 *  1) ES256 عبر المفتاح العام JWK (الصيغة الجديدة لـ Supabase) —
 *     مع رفض خلط الخوارزميات ورفض تواقيع الـ high-S.
 *  2) HMAC-SHA256 (الصيغة الكلاسيكية عبر SUPABASE_JWT_SECRET) — HS256 حصرًا.
 * أي فشل = رفض. فشل الخوارزمية المتوقعة يستلزم ضبط المتغيرات.
 */
export function verifyJwtSignature(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  let header: { alg?: string } | null = null;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  } catch {
    return false;
  }
  const alg = header?.alg;
  const unsigned = Buffer.from(`${parts[0]}.${parts[1]}`);

  try {
    const pub = getJwtPublicKey();
    if (pub) {
      // خلط خوارزميات غير مقبول: مع مفتاح EC لا نقبل سوى ES256
      if (alg !== "ES256") return false;
      const sig = Buffer.from(parts[2], "base64url");
      // توقيع خام 64 بايت (R||S) — نرفض الـ high-S ثم نحوّل لـ DER
      if (sig.length === 64) {
        const s = BigInt(`0x${sig.subarray(32, 64).toString("hex")}`);
        if (s > P256_N / BigInt(2)) return false;
        return cryptoVerify("sha256", unsigned, pub, rawEcdsaToDer(sig));
      }
      return cryptoVerify("sha256", unsigned, pub, sig);
    }

    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) return false;
    // مسار HMAC القديم لا يقبل سوى HS256 صراحة
    if (alg !== "HS256") return false;
    const expected = createHmac("sha256", secret).update(unsigned).digest("base64url");
    const a = Buffer.from(parts[2]);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}