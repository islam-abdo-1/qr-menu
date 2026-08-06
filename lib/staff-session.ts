import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

/** جلسة الموظفين: ملف تعريف موقعّع HMAC يحمل slug المطعم — لا يلزم مصادقة عامة */
const COOKIE = "staff-auth";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 ساعة

function secret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "staff-dev-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function setStaffSession(slug: string) {
  const expires = Date.now() + TTL_MS;
  const payload = `${slug}.${expires}`;
  const token = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function clearStaffSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** slug المطعم صاحب الجلسة أو null */
export async function getStaffSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const payload = `${parts[0]}.${parts[1]}`;
  if (!safeEqual(sign(payload), parts[2])) return null;

  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;

  return parts[0];
}
