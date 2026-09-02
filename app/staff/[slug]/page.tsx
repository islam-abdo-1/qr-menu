import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StaffShell } from "@/components/staff/staff-shell";
import { getBillingEnabled, getBillingInfo, isBillingExpired } from "@/lib/billing";
import { MONTHLY_PRICE, ANNUAL_PRICE } from "@/lib/billing-constants";
import { DEMO_SLUG, isDemoSlug } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: { slug },
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { name: true, settings: { select: { restaurantName: true } } },
  });
  const name = restaurant?.settings?.restaurantName || restaurant?.name;
  return {
    title: name ? `${name} — شاشة الموظفين` : "شاشة الموظفين — QR Menu",
  };
}

export default async function StaffRestaurantPage({
  params: { slug },
}: {
  params: { slug: string };
}) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      name: true,
      staffPin: true,
      blocked: true,
      trialEndsAt: true,
      paidUntil: true,
      billingExempt: true,
      settings: { select: { logoUrl: true } },
    },
  });
  if (!restaurant) notFound();

  // SEC-004: شاشة موظفي العرض التجريبي لا وجود لها — الصفحة تُعرض تبليغًا فقط
  // (طبقة إضافية فوق رفض server actions للدخول — لا واجهة ولا قدرة تشغيلية)
  if (isDemoSlug(slug)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 text-gold text-2xl font-black">
          !
        </div>
        <h1 className="font-display text-2xl font-bold text-gold-gradient">
          {DEMO_SLUG === slug ? "العرض التجريبي للتصفح فقط" : ""}
        </h1>
        <p className="max-w-sm text-sm text-cream/75">
          لا توجد شاشة موظفين للعرض التجريبي — جرّب المنتج بتسجيل مطعمك الخاص.
        </p>
      </main>
    );
  }

  if (restaurant.blocked) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive text-2xl font-black">
          !
        </div>
        <h1 className="font-display text-2xl font-bold text-gold-gradient">الشاشة موقوفة مؤقتًا</h1>
        <p className="max-w-sm text-sm text-cream/75">
          تواصل مع إدارة المنصة لمعرفة التفاصيل.
        </p>
      </main>
    );
  }
  const billingEnabled = await getBillingEnabled();
  const billing = getBillingInfo(restaurant, billingEnabled);
  if (isBillingExpired(billing)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive text-2xl font-black">
          !
        </div>
        <h1 className="font-display text-2xl font-bold text-gold-gradient">انتهت الفترة المجانية</h1>
        <p className="max-w-sm text-sm text-cream/75">
          جدّد اشتراكك ({MONTHLY_PRICE} ج.م شهريًا أو {ANNUAL_PRICE} ج.م سنويًا) من لوحة الإدارة
          لاستكمال استقبال الطلبات — منيو المطعم يبقى متاحًا للعملاء.
        </p>
      </main>
    );
  }
  return <StaffShell slug={slug} logoUrl={restaurant.settings?.logoUrl ?? null} />;
}
