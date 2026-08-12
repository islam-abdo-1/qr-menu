import "server-only";
import { prisma } from "@/lib/prisma";
export { MONTHLY_PRICE, ANNUAL_PRICE, TRIAL_DAYS } from "@/lib/billing-constants";

export type BillingStatus = "exempt" | "active" | "trial" | "expired";

export type BillingInfo = {
  status: BillingStatus;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  exempt: boolean;
};

type BillingFields = {
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  billingExempt: boolean;
};

/** حالة الاشتراك: مستثنى > مدفوع > تجربة > منتهي (بغضّ النظر عن تفعيل البوابة) */
export function getBillingInfo(r: BillingFields, billingEnabled: boolean): BillingInfo {
  const now = new Date();
  if (r.billingExempt) {
    return { status: "exempt", trialEndsAt: r.trialEndsAt, paidUntil: r.paidUntil, exempt: true };
  }
  if (r.paidUntil && r.paidUntil > now) {
    return { status: "active", trialEndsAt: r.trialEndsAt, paidUntil: r.paidUntil, exempt: false };
  }
  // الفوترة غير مفعّلة بعد (مرحلة ما قبل البوابة) — لا قيود على أي مطعم
  if (!billingEnabled) {
    return { status: "active", trialEndsAt: r.trialEndsAt, paidUntil: r.paidUntil, exempt: false };
  }
  if (r.trialEndsAt && r.trialEndsAt > now) {
    return { status: "trial", trialEndsAt: r.trialEndsAt, paidUntil: r.paidUntil, exempt: false };
  }
  return { status: "expired", trialEndsAt: r.trialEndsAt, paidUntil: r.paidUntil, exempt: false };
}

/** هل الاشتراك منتهٍ ويجب منع دخول لوحة الأدمن/الموظفين والإجراءات؟ */
export function isBillingExpired(info: BillingInfo): boolean {
  return info.status === "expired";
}

/** قراءة مفتاح تفعيل/تعطيل الفوترة من إعدادات المنصة */
export async function getBillingEnabled(): Promise<boolean> {
  const row = await prisma.siteSetting.findUnique({ where: { key: "billingEnabled" } });
  return row?.value === "true";
}

/** هل اشتراك المالك منتهٍ؟ — يُستخدم في إجراءات لوحة الإدارة لمنع التعديل بعد انتهاء التجربة */
export async function isOwnerBillingExpired(r: BillingFields): Promise<boolean> {
  const billingEnabled = await getBillingEnabled();
  return isBillingExpired(getBillingInfo(r, billingEnabled));
}

/** الأيام المتبقية من الفترة المجانية (لتقرّب للأسفل) */
export function trialDaysLeft(trialEndsAt: Date | null): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}
