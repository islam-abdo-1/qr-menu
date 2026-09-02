import "server-only";
import { distributedRateLimit, distributedRateLimitIp } from "./distributed-rate-limit";

/**
 * معدل موزع (Cloudflare KV + ذاكرة كبديل) — يطفئ الانفجارات من نفس IP عبر جميع المثيلات.
 * يحتاج متغيرات CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN في البيئة.
 * بدونه يعود للذاكرة المحلية (لكل مثيل).
 */
export function rateLimit(
  keyPrefix: string,
  req: Request,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  return distributedRateLimit(keyPrefix, req, limit, windowMs);
}

/** نسخة عناوين مباشرة — تُستخدم في Server Actions حيث لا يوجد كائن Request */
export async function rateLimitIp(
  keyPrefix: string,
  ip: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  return distributedRateLimitIp(keyPrefix, ip, limit, windowMs);
}