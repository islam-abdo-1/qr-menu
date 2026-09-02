/**
 * PHASE 5.3 — قواعد الاشتراك: تعريف واحد صاحب سلطة، مستهلكون متعددون.
 * وحدة خالصة بلا خادم/قاعدة — مطابقة حرفيًا في qr-menu وowner-app
 * (اختبار مزامنة يفرض التطابق: tests/billing-core.test.ts).
 *
 * أي تغيير في قواعد الفوترة يبدأ من هنا فقط — لا منطق فوترة مبعثر في الملفات.
 */

export type BillingStatus = "exempt" | "active" | "trial" | "expired";

export type BillingFields = {
  trialEndsAt: Date | string | null;
  paidUntil: Date | string | null;
  billingExempt: boolean;
};

/** مدة الخطة بالأيام — قاعدة تمديد الاشتراك الوحيدة (الشهر = 30، السنة = 365) */
export const PLAN_DAYS = { monthly: 30, annual: 365 } as const;
export type Plan = keyof typeof PLAN_DAYS;

/** أسعار الاشتراك — القرار النهائي */
export const MONTHLY_PRICE = 250;
export const ANNUAL_PRICE = 2300;
export const TRIAL_DAYS = 7;

export function planDurationDays(plan: Plan): number {
  return PLAN_DAYS[plan];
}

export function planPrice(plan: Plan): number {
  return plan === "annual" ? ANNUAL_PRICE : MONTHLY_PRICE;
}

/**
 * تطبيع أي قيمة تاريخ (Date / نص ISO / رقم) إلى Date — دفاع ضد سيناريو
 * تسلسل JSON (مثل كاش unstable_cache) الذي يحوّل Date إلى نص،
 * ونصوص NFE التاريخية. يُعيد null لقيم فارغة أو غير صالحة.
 */
export function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** حالة الاشتراك: مستثنى > مدفوع > تجربة > منتهي (بغضّ النظر عن تفعيل البوابة) */
export function billingStatusOf(r: BillingFields, billingEnabled: boolean): BillingStatus {
  const now = Date.now();
  const trialEndsAt = toDate(r.trialEndsAt);
  const paidUntil = toDate(r.paidUntil);
  if (r.billingExempt) return "exempt";
  if (paidUntil && paidUntil.getTime() > now) return "active";
  // الفوترة غير مفعّلة بعد (مرحلة ما قبل البوابة) — لا قيود على أي مطعم
  if (!billingEnabled) return "active";
  if (trialEndsAt && trialEndsAt.getTime() > now) return "trial";
  return "expired";
}

/** هل الاشتراك منتهٍ ويجب منع دخول لوحة الأدمن/الموظفين والإجراءات؟ */
export function isBillingExpired(info: { status: BillingStatus }): boolean {
  return info.status === "expired";
}

/** الأيام المتبقية من الفترة المجانية (لتقرّب للأسفل) */
export function trialDaysLeft(trialEndsAt: Date | string | null): number {
  const d = toDate(trialEndsAt);
  if (!d) return 0;
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

/**
 * نهاية الفترة بعد تمديد: يبدأ من نهاية الفترة الحالية إن لم تكن انتهت،
 * وإلا من الآن — لا يُمنح وقت منقضٍ أبدًا. (قاعدة تمديد الدفعات والتجربة)
 */
export function subscriptionEndAfter(base: Date | null, now: Date, days: number): Date {
  const start = base && base.getTime() > now.getTime() ? base : now;
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}
