import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

/** جلسة الموظفين: ملف تعريف موقعّع HMAC يحمل slug المطعم — لا يلزم مصادقة عامة */
const COOKIE = "staff-auth";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة بدون «تذكرني»
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 يومًا مع «تذكرني»

/**
 * مفتاح توقيع جلسات الموظفين — فشل-مغلق: لا يوجد أي مفتاح احتياطي منشور.
 * غياب SUPABASE_SERVICE_ROLE_KEY (أو قيمة وهمية) = رفض توقيع جلسات الموظفين نهائيًا.
 */
function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s || /^(your-|dummy|staff-dev-secret|sb_publishable)/i.test(s)) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY غير مضبوط — جلسات الموظفين معطّلة (فشل مغلق)");
  }
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

export async function setStaffSession(session: StaffSession, remember = true) {
  const ttl = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS;
  const expires = Date.now() + ttl;
  const payload = `${session.slug}.${encodeURIComponent(session.name)}.${expires}`;
  const token = `${payload}.${sign(payload, secret())}`;
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
  let theSecret: string;
  try {
    theSecret = secret();
  } catch {
    return null;
  }
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  if (!safeEqual(sign(payload, theSecret), parts[3])) return null;

  const expires = Number(parts[2]);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;

  return { slug: parts[0], name: decodeURIComponent(parts[1]) };
}
