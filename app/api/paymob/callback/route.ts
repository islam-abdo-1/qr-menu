import { revalidateTag } from "next/cache";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaymobSignature } from "@/lib/paymob";
import { OWNER_TAG, MENU_TAG } from "@/lib/data";
import { MONTHLY_PRICE, ANNUAL_PRICE } from "@/lib/billing-constants";

export const dynamic = "force-dynamic";

/**
 * رد البوابة بعد الدفع — يتحقق من توقيع HMAC ثم:
 * نجاح: إتمام الدفعة المعلّقة ومدّ اشتراك المطعم (paidUntil) بدءًا من انتهاء الاشتراك الحالي.
 * فشل/إلغاء: تعليم الدفعة فاشلة.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("invalid payload", { status: 400 });
  }
  try {
    const objRaw = String(form.get("obj") ?? "");
    const hmac = String(form.get("hmac") ?? "");

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(objRaw);
    } catch {
      return new Response("invalid payload", { status: 400 });
    }

    if (!verifyPaymobSignature(obj, hmac)) {
      return new Response("bad signature", { status: 401 });
    }

    const paymobRef = String(obj.order ?? "");
    const success = String(obj.success ?? "") === "true";
    const amountCents = Number(obj.amount_cents ?? 0);

    const payment = await prisma.payment.findUnique({
      where: { paymobRef },
      include: { restaurant: { select: { id: true, paidUntil: true } } },
    });
    if (!payment) {
      return new Response("payment not found", { status: 404 });
    }

    if (!success) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed" },
      });
      return new Response("payment failed");
    }

    const expectedCents =
      (payment.plan === "annual" ? ANNUAL_PRICE : MONTHLY_PRICE) * 100;
    if (amountCents !== expectedCents) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed" },
      });
      return new Response("amount mismatch", { status: 409 });
    }

    const now = new Date();
    const base =
      payment.restaurant.paidUntil && payment.restaurant.paidUntil > now
        ? payment.restaurant.paidUntil
        : now;
    const paidUntil = new Date(
      base.getTime() + (payment.plan === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000,
    );

    const [pay] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "paid" },
      }),
      prisma.restaurant.update({
        where: { id: payment.restaurantId },
        data: { paidUntil, trialEndsAt: null },
      }),
    ]);
    if (pay) {
      revalidateTag(OWNER_TAG);
      revalidateTag(MENU_TAG);
    }
    return new Response("success");
  } catch (e) {
    console.error("[paymob] callback failed:", e);
    return new Response("internal error", { status: 500 });
  }
}