/**
 * أدوات جلسة Supabase SSR مشتركة بين Edge (middleware) و Node (server components).
 * خالية من Prisma و server-only — لا تستورد أي شيء خارجي ثقيل.
 */

export type CookieLike = { name: string; value: string };

function decodeBase64Url(str: string): string {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, "=");
  return new TextDecoder().decode(
    Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
  );
}

/**
 * قراءة قيمة كوكي الجلسة مع دمج الأجزاء (Chunked Cookies):
 * عند كبر الجلسة تكتبها المكتبة بأسماء sb-xxx-auth-token.0 / .1 ...
 * — نجمعها بالترتيب الرقمي لنفس قيمة الكوكي الأصلية.
 */
export function sessionCookieValue(all: CookieLike[]): string | null {
  const main = all.find((c) => c.name.endsWith("-auth-token"));
  if (main) return main.value;
  const chunks = all
    .filter((c) => /-auth-token\.\d+$/.test(c.name))
    .sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop()))
    .map((c) => c.value);
  return chunks.length ? chunks.join("") : null;
}

/** استخراج توكن الوصول من قيمة كوكي الجلسة (base64-<json> أو JWT خام) */
export function tokenFromSessionCookie(value: string): string | null {
  if (!value.startsWith("base64-")) return value || null;
  try {
    const b64 = value.slice(7).replace(/-/g, "+").replace(/_/g, "/");
    const session = JSON.parse(decodeBase64Url(b64));
    return typeof session.access_token === "string" ? session.access_token : null;
  } catch {
    return null;
  }
}

/** فك حمولة JWT محليًا — بلا شبكة وبلا تحقق توقيع */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(decodeBase64Url(parts[1]));
    return typeof json === "object" && json !== null ? json : null;
  } catch {
    return null;
  }
}

/**
 * جلسة صالحة محليًا (صفر شبكة): كوكي موجود + توكن غير منتهٍ + معرّف مستخدم.
 * تُستخدم في الـ layout والـ middleware لتجنّب استدعاء getUser() المزدوج
 * (سباق تدوير refresh token الذي يسبب طلب الدخول المتكرر).
 */
export function hasValidSession(all: CookieLike[]): boolean {
  const value = sessionCookieValue(all);
  const token = value ? tokenFromSessionCookie(value) : null;
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp * 1000 : null;
  return !!exp && exp > Date.now() && typeof payload?.sub === "string";
}
