import "server-only";
import { prisma } from "@/lib/prisma";
import {
  ANNUAL_PRICE,
  MONTHLY_PRICE,
  TRIAL_DAYS,
  billingStatusOf,
  isBillingExpired,
  toDate,
  trialDaysLeft,
  type BillingFields,
} from "@/lib/billing-core";

/**
 * قواعد الفوترة (الحالة/المدد/الأسعار) في billing-core — هذا الملف للربط بالخادم فقط:
 * قراءة مفتاح تفعيل الفوترة من القاعدة وتجميع حالة الاشتراك مع التواريخ.
 */
export { ANNUAL_PRICE, MONTHLY_PRICE, TRIAL_DAYS, billingStatusOf, isBillingExpired, toDate, trialDaysLeft };

export type BillingStatus = "exempt" | "active" | "trial" | "expired";

export type BillingInfo = {
  status: BillingStatus;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  exempt: boolean;
};

/**
 * حالة الاشتراك مع التواريخ — القرار من billingStatusOf (مصدر واحد)،
 * إضافةً للتواريخ المطلوبة للعرض.
 */
export function getBillingInfo(r: BillingFields, billingEnabled: boolean): BillingInfo {
  const trialEndsAt = toDate(r.trialEndsAt);
  const paidUntil = toDate(r.paidUntil);
  return {
    status: billingStatusOf(r, billingEnabled),
    trialEndsAt,
    paidUntil,
    exempt: r.billingExempt,
  };
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