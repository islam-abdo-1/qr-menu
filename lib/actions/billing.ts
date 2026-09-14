"use server";

import { prisma } from "@/lib/prisma";
import { getOwnerRestaurant } from "@/lib/data";
import { getBillingEnabled, getBillingInfo } from "@/lib/billing";
import { MONTHLY_PRICE, ANNUAL_PRICE } from "@/lib/billing-constants";
import { createPaymobCheckout, isPaymobConfigured, newPaymentRef } from "@/lib/paymob";
import { ActionResult, fail, ok } from "@/lib/actions/helpers";

/**
 * بدء دفع الاشتراك:
 * - بلا مفاتيح Paymob (المرحلة أ): رسالة «قريبًا» — الإدارة تسجّل الدفعة يدويًا من لوحة المالك.
 * - مع المفاتيح: سجل مدفوعات معلّق + رابط iframe للدفع شبكة Paymob.
 */
export async function subscribeAction(
  plan: "monthly" | "annual",
): Promise<ActionResult<{ iframeUrl: string } | null>> {
  if (plan !== "monthly" && plan !== "annual") {
    return fail("خطة غير صالحة");
  }
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("لا يوجد مطعم مرتبط بحسابك");
    if (restaurant.blocked) return fail("المطعم محظور — تواصل مع الإدارة");
    if (restaurant.billingExempt) return fail("حسابك مستثنى نهائيًا من الاشتراك");

    if (!isPaymobConfigured()) {
      return fail(
        `الدفع الإلكتروني متاح قريبًا — تواصل مع الإدارة للتفعيل اليدوي (${MONTHLY_PRICE} ج.م شهريًا أو ${ANNUAL_PRICE} ج.م سنويًا)`,
      );
    }

    const setting = await prisma.setting.findUnique({
      where: { restaurantId: restaurant.id },
      select: { restaurantName: true },
    });

    const checkout = await createPaymobCheckout(
      plan,
      setting?.restaurantName ?? restaurant.name,
      "owner@qr-menu.app",
    );

    // سجلّ الدفعة معلّقة — يكتملها/يفشلها رد البوابة على /api/paymob/callback
    const paymobRef = newPaymentRef();
    await prisma.payment.create({
      data: {
        restaurantId: restaurant.id,
        amount: plan === "annual" ? ANNUAL_PRICE : MONTHLY_PRICE,
        plan,
        method: "paymob",
        paymobRef,
        status: "pending",
      },
    });
    // ربط مرجع الرد (order.id من البوابة) بالدفعة المعلّقة
    await prisma.payment.updateMany({
      where: { restaurantId: restaurant.id, status: "pending", paymobRef },
      data: { paymobRef: checkout.orderId },
    });

    return ok({ iframeUrl: checkout.iframeUrl });
  } catch (e) {
    console.error("[billing] subscribeAction:", e);
    return fail("تعذّر بدء الدفع — حاول لاحقًا");
  }
}

/** معلومات اشتراك المالك الحالية (لقسم الاشتراك في اللوحة) */
export async function getBillingStatusAction(): Promise<
  ActionResult<{
    status: string;
    trialEndsAt: string | null;
    paidUntil: string | null;
    billingEnabled: boolean;
  }>
> {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("لا يوجد مطعم مرتبط بحسابك");
    if (restaurant.blocked) return fail("المطعم محظور — تواصل مع الإدارة");
    const billingEnabled = await getBillingEnabled();
    const info = getBillingInfo(restaurant, billingEnabled);
    return ok({
      status: info.status,
      trialEndsAt: info.trialEndsAt?.toISOString() ?? null,
      paidUntil: info.paidUntil?.toISOString() ?? null,
      billingEnabled,
    });
  } catch (e) {
    console.error("[billing] getBillingStatusAction:", e);
    return fail("تعذّر قراءة حالة الاشتراك");
  }
}