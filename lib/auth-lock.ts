import "server-only";

/**
 * حارس تخمين كلمات المرور (SEC-001) — قفل زمني متجدد (نافذة منزلقة):
 *  - الحساب: 5 محاولات فاشلة خلال 15 دقيقة = قفل مؤقت.
 *  - IP: 20 محاولة فاشلة خلال 15 دقيقة = قفل مؤقت (يصدّ الرش على عدة حسابات).
 * لا يوجد قفل دائم أبدًا (لا يقبل أحد أن يحوّل الحماية إلى هجوم إقصاء) —
 * النجاح يمسح السجل، والنافذة تنزلق فتفتح القفل تلقائيًا.
 */

export const LOCK_WINDOW_MS = 15 * 60 * 1000;
export const ACCOUNT_MAX_FAILED = 5;
export const IP_MAX_FAILED = 20;

/** رسالة موحّدة للقفل — نفس النص للحساب والجهاز حتى لا نكشف أي معلومة */
export const LOCKED_MESSAGE = "محاولات دخول كثيرة — انتظر ١٥ دقيقة ثم أعد المحاولة";
/** رسالة فشل الاعتمادات موحّدة تمامًا (لا تمييز بين حساب غير موجود وكلمة خاطئة وبريد غير مؤكد) */
export const INVALID_CREDENTIALS_MESSAGE =
  "بيانات الدخول غير صحيحة — تأكد من البريد وكلمة المرور";

/**
 * قرار القفل النقي: يحسب من عددي المحاولات الفاشلة (الحساب + IP) خلال النافذة.
 * أي تعبئة زائدة تُرفض إن كانت ضمن حدود معقولة (أمان إضافي ضد البيانات الفاسدة).
 */
export function loginLockDecision(
  accountFailed: number,
  ipFailed: number,
): { locked: boolean; message: string | null } {
  if (
    !Number.isFinite(accountFailed) ||
    !Number.isFinite(ipFailed) ||
    accountFailed < 0 ||
    ipFailed < 0 ||
    accountFailed > 1_000_000 ||
    ipFailed > 1_000_000
  ) {
    return { locked: true, message: LOCKED_MESSAGE };
  }
  if (accountFailed >= ACCOUNT_MAX_FAILED || ipFailed >= IP_MAX_FAILED) {
    return { locked: true, message: LOCKED_MESSAGE };
  }
  return { locked: false, message: null };
}

/**
 * ترجمة رسائل المصادقة إلى نص موحّد — عقد عدم التمييز (No user enumeration):
 * كل أخطاء الاعتمادات (كلمة خاطئة / حساب غير موجود / بريد غير مؤكد) تصب في رسالة واحدة،
 * ولا يُستثنى إلا الرفض العام بسبب معدل الطلبات (لا يكشف أي شيء عن الحسابات).
 */
export function uniformLoginError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "طلبات كثيرة — انتظر قليلًا ثم حاول";
  }
  return INVALID_CREDENTIALS_MESSAGE;
}

/** هل خطأ الاعتمادات «فشل فعلًا» يُحتسب في عدّاد القفل؟ */
export function isCountableFailure(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many requests")) return false;
  if (m.includes("invalid login credentials")) return true;
  if (m.includes("email not confirmed")) return true;
  if (m.includes("user not found") || m.includes("no user found")) return true;
  return false;
}

/** مفتاح صف IP داخل جدول المحاولات — يُخزَّن في عمود email (نفس الجدول، لا جدول جديد) */
export function ipKey(ip: string): string {
  return `ip:${ip}`;
}