import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

/** جلسة الموظفين: ملف تعريف موقعّع HMAC يحمل slug المطعم — لا يلزم مصادقة عامة */
const COOKIE = "staff-auth";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة بدون «تذكرني»
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 يومًا مع «تذكرني»

/**
 * المفتاح الأساسي لتوقيع جلسات الموظفين: STAFF_SESSION_SECRET — سر مستقل تمامًا
 * عن SUPABASE_SERVICE_ROLE_KEY (فصل الاعتمادات: سر المنصة لا يعلّق على سر القاعدة).
 * فشل-مغلق: غيابه أو قيمته الوهمية = رفض توقيع جلسات الموظفين نهائيًا.
 */
function primarySecret(): string {
  const s = process.env.STAFF_SESSION_SECRET;
  if (!s || /^(your-|dummy|staff-dev-secret|sb_publishable)/i.test(s)) {
    throw new Error("STAFF_SESSION_SECRET غير مضبوط — جلسات الموظفين معطّلة (فشل مغلق)");
  }
  return s;
}

/**
 * مفتاح التوقيع القديم (SUPABASE_SERVICE_ROLE_KEY) — يُقبل للتحقق فقط ضمن نافذة
 * التوافق 30 يومًا: الكوكيز الصادرة قبل النشر تُحترم حتى انتهاء TTL ولا تُسقط
 * جلسات الموظفين بشكل غير متوقع. تُحذف هذه النافذة بعد 30 يومًا من النشر
 * (التوقف مقرر تقريبًا 2026-09-18) — لا يصدر أي كوكي جديد بهذا المفتاح.
 */
function legacySecret(): string | null {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s || /^(your-|dummy|staff-dev-secret|sb_publishable)/i.test(s)) return null;
  return s;
}

function sign(payload: string, key: string) {
  return createHmac("sha256", key).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export type StaffSession = { slug: string; name: string };

/**
 * ترميز آمن للحمولة: base64url(JSON{slug,name,expires}) —
 * الاسم قد يحوي نقاطًا («م. أحمد») فالفواصل النقطية كانت تكسر الرص
 * وتطرد الموظف برسالة جلسة فاسدة.
 */
function encodePayload(s: StaffSession, expires: number): string {
  return Buffer.from(JSON.stringify({ ...s, expires })).toString("base64url");
}

function decodePayload(raw: string): { slug: string; name: string; expires: number } | null {
  try {
    const obj = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof obj?.slug !== "string" ||
      typeof obj?.name !== "string" ||
      typeof obj?.expires !== "number"
    ) {
      return null;
    }
    return { slug: obj.slug, name: obj.name, expires: obj.expires };
  } catch {
    return null;
  }
}

export async function setStaffSession(session: StaffSession, remember = true) {
  const ttl = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS;
  const payload = encodePayload(session, Date.now() + ttl);
  const token = `${payload}.${sign(payload, primarySecret())}`;
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttl / 1000,
  });
}

export async function clearStaffSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** جلسة الموظف الحالية أو null — أي خلل في الإعداد = لا جلسة (فشل مغلق) */
export async function getStaffSession(): Promise<StaffSession | null> {
  // مفاتيح التحقق: الأساسي ثم سلف Legacy (نافذة 30 يومًا) — أيٌّ منهما يمرر الكوكي القائم
  const candidates: string[] = [];
  try {
    candidates.push(primarySecret());
  } catch {
    /* لا أساسي — نكتفي بالسلف إن وُجد */
  }
  const legacy = legacySecret();
  if (legacy && !candidates.includes(legacy)) candidates.push(legacy);
  if (candidates.length === 0) return null;

  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  if (!candidates.some((key) => safeEqual(sign(parts[0], key), parts[1]))) return null;

  const data = decodePayload(parts[0]);
  if (!data) return null;
  if (!Number.isFinite(data.expires) || data.expires < Date.now()) return null;

  return { slug: data.slug, name: data.name };
}
