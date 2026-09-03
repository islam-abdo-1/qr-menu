"use server";

/**
 * التحقق من Cloudflare Turnstile Token
 * استخدم في Server Actions لحماية النماذج من البوتات
 * Fail-open mode: إذا لم يتم تكوين المفاتيح، يتم تجاوز التحقق لتحسين الأداء
 */
let turnstileEnabledCache: boolean | null = null;

export async function verifyTurnstile(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;

  // التحقق مما إذا كان Turnstile مفعلاً (مفتاح السر موجود) - مخزن مؤقتاً لتجنب قراءة env كل مرة
  if (turnstileEnabledCache === null) {
    turnstileEnabledCache = !!process.env.TURNSTILE_SECRET_KEY;
  }

  // Fail-open: إذا لم يتم تكوين مفاتيح Turnstile، تجاوز التحقق فوراً لتحسين الأداء
  if (!turnstileEnabledCache) {
    return true;
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY!;
  
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secretKey, response: token }),
      // مهلة قصيرة لتجنب حجب المصادقة
      signal: AbortSignal.timeout(3000),
    });

    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error("[Turnstile] Verification failed:", e);
    // في حالة فشل الشبكة، نمرر الطلب (fail-open) لتجربة مستخدم أفضل
    return true;
  }
}