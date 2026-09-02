import { describe, expect, it, vi, afterEach } from "vitest";
import { generateKeyPairSync, createSign } from "crypto";

/**
 * PHASE 5.4 — التحقق المحلي من توقيع JWT:
 * ES256/JWK مع رفض high-S، وHS256 احتياطي، وفشل مغلق — كل مسار بلا شبكة.
 * (getJwtPublicKey يخزّن المفتاح في كاش الوحدة — كل اختبار يُعيد تحميل الوحدة
 * عبر vi.resetModules للحصول على كاش جديد بعد وضع المتغيرات.)
 */

const N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");

function makeKeyPair() {
  return generateKeyPairSync("ec", { namedCurve: "P-256" });
}

function jwkEnvOf(pub: ReturnType<typeof makeKeyPair>["publicKey"]): string {
  const jwk = pub.export({ format: "jwk" });
  return JSON.stringify({ keys: [jwk] });
}

function derToRaw(der: Buffer): Buffer {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error("bad seq");
  const seqLen = der[i++];
  let end = i + seqLen;
  const readInt = () => {
    if (der[i++] !== 0x02) throw new Error("bad int tag");
    const len = der[i++];
    const v = der.subarray(i, i + len);
    i += len;
    return v.length > 32 ? v.subarray(1) : v;
  };
  const r = readInt();
  const s = readInt();
  if (i !== end) throw new Error("trailing");
  // التواقيع السليمة من المصدرين الحقيقيين منخفضة-S (canonical low-S) —
  // OpenSSL قد تُصدر عالية-S (مرفوضة بقصد): نطبّعها حتى نختبر المسار السليم
  const sBig = BigInt(`0x${s.toString("hex")}`);
  const lowS = sBig > N / BigInt(2) ? N - sBig : sBig;
  const sNorm = Buffer.from(lowS.toString(16).padStart(64, "0"), "hex");
  return Buffer.concat([
    Buffer.alloc(32 - r.length),
    r,
    Buffer.alloc(32 - sNorm.length),
    sNorm,
  ]);
}

function signToken(priv: ReturnType<typeof makeKeyPair>["privateKey"], header: object, payload: object): string {
  const b64u = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${b64u(header)}.${b64u(payload)}`;
  const der = createSign("sha256").update(unsigned).end().sign(priv);
  return `${unsigned}.${derToRaw(der).toString("base64url")}`;
}

function rawOf(token: string): { r: bigint; s: bigint } {
  const sig = Buffer.from(token.split(".")[2], "base64url");
  const r = BigInt(`0x${sig.subarray(0, 32).toString("hex")}`);
  const s = BigInt(`0x${sig.subarray(32, 64).toString("hex")}`);
  return { r, s };
}

function withHighS(token: string): string {
  const sig = Buffer.from(token.split(".")[2], "base64url");
  const { s } = rawOf(token);
  const flipped = Buffer.from(sig);
  const s2 = (N - s).toString(16).padStart(64, "0");
  Buffer.from(s2, "hex").copy(flipped, 32);
  return `${token.split(".")[0]}.${token.split(".")[1]}.${flipped.toString("base64url")}`;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PHASE 5.4 — verifyJwtSignature: ES256/JWK", () => {
  it("توقيع سليم بمفتاح EC → مقبول", async () => {
    const { publicKey, privateKey } = makeKeyPair();
    vi.stubEnv("SUPABASE_JWT_PUBLIC_KEY", jwkEnvOf(publicKey));
    vi.resetModules();
    const { verifyJwtSignature } = await import("@/lib/jwt");
    const token = signToken(privateKey, { alg: "ES256", typ: "JWT" }, { sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(verifyJwtSignature(token)).toBe(true);
  });

  it("عبث بالحمولة → مرفوض", async () => {
    const { publicKey, privateKey } = makeKeyPair();
    vi.stubEnv("SUPABASE_JWT_PUBLIC_KEY", jwkEnvOf(publicKey));
    vi.resetModules();
    const { verifyJwtSignature } = await import("@/lib/jwt");
    const token = signToken(privateKey, { alg: "ES256" }, { sub: "u1" });
    const [h, , s] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: "u2" })).toString("base64url");
    expect(verifyJwtSignature(`${h}.${tamperedPayload}.${s}`)).toBe(false);
  });

  it("مفتاح آخر (توقيع بمفتاح غير المكوّن) → مرفوض", async () => {
    const { publicKey } = makeKeyPair();
    const { privateKey: otherPriv } = makeKeyPair();
    vi.stubEnv("SUPABASE_JWT_PUBLIC_KEY", jwkEnvOf(publicKey));
    vi.resetModules();
    const { verifyJwtSignature } = await import("@/lib/jwt");
    const token = signToken(otherPriv, { alg: "ES256" }, { sub: "u1" });
    expect(verifyJwtSignature(token)).toBe(false);
  });

  it("توقيع high-S (التمثيل المتحرك المرن) → مرفوض حتى لو كان التوقيع الأصلي سليمًا", async () => {
    const { publicKey, privateKey } = makeKeyPair();
    vi.stubEnv("SUPABASE_JWT_PUBLIC_KEY", jwkEnvOf(publicKey));
    vi.resetModules();
    const { verifyJwtSignature } = await import("@/lib/jwt");
    const token = signToken(privateKey, { alg: "ES256" }, { sub: "u1" });
    expect(verifyJwtSignature(token)).toBe(true);
    const highS = withHighS(token);
    expect(rawOf(highS).s).toBeGreaterThan(N / BigInt(2));
    expect(verifyJwtSignature(highS)).toBe(false);
  });

  it("خلط خوارزميات: مع مفتاح EC لا يُقبل سوى ES256", async () => {
    const { publicKey, privateKey } = makeKeyPair();
    vi.stubEnv("SUPABASE_JWT_PUBLIC_KEY", jwkEnvOf(publicKey));
    vi.resetModules();
    const { verifyJwtSignature } = await import("@/lib/jwt");
    const token = signToken(privateKey, { alg: "HS256" }, { sub: "u1" });
    expect(verifyJwtSignature(token)).toBe(false);
  });

  it("بنية فاسدة: جزءان فقط / رأس غير JSON → مرفوض", async () => {
    vi.stubEnv("SUPABASE_JWT_PUBLIC_KEY", jwkEnvOf(makeKeyPair().publicKey));
    vi.resetModules();
    const { verifyJwtSignature } = await import("@/lib/jwt");
    expect(verifyJwtSignature("a.b")).toBe(false);
    expect(verifyJwtSignature("!!!.e30.c2ln")).toBe(false);
  });
});

describe("PHASE 5.4 — verifyJwtSignature: HS256 احتياطي", () => {
  it("توقيع سليم بسر مشترك → مقبول (HS256 حصرًا)", async () => {
    vi.stubEnv("SUPABASE_JWT_PUBLIC_KEY", "");
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret-0123456789abcdef");
    vi.resetModules();
    const { verifyJwtSignature } = await import("@/lib/jwt");
    const { createHmac } = await import("crypto");
    const b64u = (s: string) => Buffer.from(s).toString("base64url");
    const unsigned = `${b64u(JSON.stringify({ alg: "HS256" }))}.${b64u(JSON.stringify({ sub: "u1" }))}`;
    const sig = createHmac("sha256", "test-jwt-secret-0123456789abcdef").update(unsigned).digest("base64url");
    expect(verifyJwtSignature(`${unsigned}.${sig}`)).toBe(true);
    expect(verifyJwtSignature(`${unsigned}.${sig.slice(0, -2)}xx`)).toBe(false);
  });

  it("بلا أي مفتاح/سر → فشل مغلق", async () => {
    vi.stubEnv("SUPABASE_JWT_PUBLIC_KEY", "");
    vi.stubEnv("SUPABASE_JWT_SECRET", "");
    vi.resetModules();
    const { verifyJwtSignature } = await import("@/lib/jwt");
    expect(verifyJwtSignature("a.b.c")).toBe(false);
  });
});

describe("PHASE 5.4 — hasValidSession (الاستدلال السريع فقط، لا تفويض)", () => {
  async function loadSession() {
    const { hasValidSession } = await import("@/lib/session");
    return hasValidSession;
  }

  it("توكن سليم غير منتهٍ مع sub → جلسة صالحة (JWT خام وكوكي base64- معًا)", async () => {
    const { publicKey, privateKey } = makeKeyPair();
    vi.stubEnv("SUPABASE_JWT_PUBLIC_KEY", jwkEnvOf(publicKey));
    const fn = await loadSession();
    const token = signToken(privateKey, { alg: "ES256" }, { sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(fn([{ name: "sb-x-auth-token", value: token }])).toBe(true);
    const wrapped = `base64-${Buffer.from(JSON.stringify({ access_token: token })).toString("base64")}`;
    expect(fn([{ name: "sb-x-auth-token", value: wrapped }])).toBe(true);
  });

  it("توكن منتهٍ / بلا كوكي / بلا exp / بلا sub → غير صالحة", async () => {
    const { publicKey, privateKey } = makeKeyPair();
    vi.stubEnv("SUPABASE_JWT_PUBLIC_KEY", jwkEnvOf(publicKey));
    const fn = await loadSession();
    const expired = signToken(privateKey, { alg: "ES256" }, { sub: "u1", exp: Math.floor(Date.now() / 1000) - 60 });
    expect(fn([{ name: "sb-x-auth-token", value: expired }])).toBe(false);
    expect(fn([])).toBe(false);
    const noExp = signToken(privateKey, { alg: "ES256" }, { sub: "u1" });
    expect(fn([{ name: "sb-x-auth-token", value: noExp }])).toBe(false);
    const noSub = signToken(privateKey, { alg: "ES256" }, { exp: Math.floor(Date.now() / 1000) + 60 });
    expect(fn([{ name: "sb-x-auth-token", value: noSub }])).toBe(false);
    expect(fn([{ name: "sb-x-auth-token", value: "not-a-jwt" }])).toBe(false);
  });
});
