import "server-only";

/**
 * حارس طلبات الزبائن (SEC-002):
 * - nonce: مفتاح تفرد يرسله العميل — التكرار/الإعادة يعيدان الطلب نفسه على مستوى القاعدة (قيد فريد).
 * - كوتا صارمة لكل مطعم كل نافذة: عدّاد ذري (row-lock عبر Upsert) — لا يمكن تجاوزها بالإرسال المتوازي.
 * - انفجار لكل IP في الذاكرة (لكل مثيل): يطفئ إغراق الروبوتات للنقاط العامة.
 */

/** صيغة nonce: 16-64 حرفًا من [A-Za-z0-9_-] — عشوائية UUID المعرّاة كفاية لمنع التخمين */
export const ORDER_NONCE_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** نافذة الكوتا لكل مطعم (5 دقائق) */
export const ORDER_WINDOW_MS = 5 * 60 * 1000;
/** الحد الصارم لكل مطعم داخل النافذة — 150 طلبًا/5 دقائق يستوعب أزحم المطاعم بفارق كبير */
export const ORDER_WINDOW_LIMIT = 150;

/** حد الانفجار لكل IP (في الذاكرة — يخفف الإغراق من نفس المصدر) */
export const IP_BURST_LIMIT = 30;
export const IP_BURST_WINDOW_MS = 60 * 1000;

export function isValidCartNonce(v: unknown): v is string {
  return typeof v === "string" && ORDER_NONCE_RE.test(v);
}

/** بداية النافذة الحالية (مضاعفات 5 دقائق) — مفتاح صف العدّاد */
export function orderWindowStart(now = Date.now(), windowMs = ORDER_WINDOW_MS): Date {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

/** تجاوز الكوتا الصارمة؟ (count === LIMIT مسموح — التجاوز من 151 فصاعدًا) */
export function orderQuotaExceeded(count: number, limit = ORDER_WINDOW_LIMIT): boolean {
  return count > limit;
}

/** يُرمى داخل المعاملة لرفض الطلب عند تجاوز الكوتا (يتراجع العدّاد تلقائيًا بالـ rollback) */
export class OrderQuotaError extends Error {
  constructor() {
    super("order quota exceeded");
  }
}