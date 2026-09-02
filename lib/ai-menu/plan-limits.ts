import "server-only";
import { prisma } from "@/lib/prisma";
import { toDate } from "@/lib/billing-core";

/**
 * حدود استخدام AI Menu Builder حسب باقة المطعم:
 *   التجربة:  1 استيراد إجمالي (مدى الحياة) · 10 صور · 5 صفحات · 4 أنماط
 *   الشهرية:  3 استيرادات/شهر · 60 صورة/شهر · 30 صفحة · كل الأنماط
 *   السنوية: 10 استيرادات/شهر · 250 صورة/شهر · 30 صفحة · الكل + Pinterest
 *   المستثنى: كالسنوي (بلا قيود عملية)
 */

export type PlanLimits = {
  importsTotal: number | null; // null = غير محدود
  importsPerMonth: number | null;
  imagesPerMonth: number | null;
  maxPages: number;
  styleCount: number | null; // null = الكل
  allowPinterestRefs: boolean;
  allowOpenRouterFallback: boolean; // دائماً false — معطل
  planLabel: string;
};

export async function getPlanLimits(restaurant: {
  billingExempt: boolean;
  trialEndsAt: Date | string | null;
  paidUntil: Date | string | null;
}): Promise<PlanLimits> {
  const now = new Date();
  const paidUntil = toDate(restaurant.paidUntil);
  const isActive = paidUntil !== null && paidUntil.getTime() > now.getTime();
  const trialEndsAt = toDate(restaurant.trialEndsAt);
  const isTrial =
    !isActive &&
    trialEndsAt !== null &&
    trialEndsAt.getTime() > now.getTime();

  if (restaurant.billingExempt) {
    return {
      importsTotal: null,
      importsPerMonth: 10,
      imagesPerMonth: 250,
      maxPages: 30,
      styleCount: null,
      allowPinterestRefs: true,
      allowOpenRouterFallback: false, // معطل
      planLabel: "exempt",
    };
  }
  if (isActive) {
    return {
      importsTotal: null,
      importsPerMonth: 3,
      imagesPerMonth: 60,
      maxPages: 30,
      styleCount: null,
      allowPinterestRefs: false,
      allowOpenRouterFallback: false, // معطل
      planLabel: "monthly",
    };
  }
  if (isTrial) {
    return {
      importsTotal: 1,
      importsPerMonth: null,
      imagesPerMonth: 10,
      maxPages: 5,
      styleCount: 4,
      allowPinterestRefs: false,
      allowOpenRouterFallback: false, // معطل
      planLabel: "trial",
    };
  }
  // منتهي — requireMenuEditorAccess يمنعه قبل هنا؛ حد أدنى دفاعي
  return {
    importsTotal: 0,
    importsPerMonth: 0,
    imagesPerMonth: 0,
    maxPages: 0,
    styleCount: 0,
    allowPinterestRefs: false,
    allowOpenRouterFallback: false, // معطل
    planLabel: "expired",
  };
}

export type UsageCheck = {
  ok: boolean;
  reason?: string;
  usage: { importsUsed: number; imagesUsedThisMonth: number };
};

/**
 * يتحقق من حدود الباقة قبل بدء استيراد جديد.
 * importsTotal (التجربة) يُحسب من كل تاريخ — يقفل الاستغلال.
 */
export async function checkImportQuota(
  restaurantId: string,
  restaurant: Parameters<typeof getPlanLimits>[0],
): Promise<UsageCheck> {
  const limits = await getPlanLimits(restaurant);
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );

  const [importsAllTime, importsThisMonth] = await Promise.all([
    limits.importsTotal !== null
      ? prisma.aiMenuImportJob.count({ where: { restaurantId } })
      : Promise.resolve(0),
    limits.importsPerMonth !== null
      ? prisma.aiMenuImportJob.count({
          where: { restaurantId, createdAt: { gte: monthStart } },
        })
      : Promise.resolve(0),
  ]);

  if (limits.importsTotal !== null && importsAllTime >= limits.importsTotal) {
    return {
      ok: false,
      reason: `حصتك التجريبية لاستيراد المنيو بالذكاء الاصطناعي انتهت (1 استيراد) — رقِّ باقتك للمزيد`,
      usage: { importsUsed: importsAllTime, imagesUsedThisMonth: 0 },
    };
  }
  if (
    limits.importsPerMonth !== null &&
    importsThisMonth >= limits.importsPerMonth
  ) {
    return {
      ok: false,
      reason: `وصلت حد الاستيراد الشهري (${limits.importsPerMonth}) — يتجدد أول الشهر أو رقِّ للسنوي`,
      usage: { importsUsed: importsThisMonth, imagesUsedThisMonth: 0 },
    };
  }
  return {
    ok: true,
    usage: { importsUsed: importsThisMonth, imagesUsedThisMonth: 0 },
  };
}

/** عدد الصور المولّدة هذا الشهر — قبل السماح بتوليد جديد */
export async function checkImageQuota(
  restaurantId: string,
  restaurant: Parameters<typeof getPlanLimits>[0],
): Promise<UsageCheck> {
  const limits = await getPlanLimits(restaurant);
  if (limits.imagesPerMonth === null) {
    return { ok: true, usage: { importsUsed: 0, imagesUsedThisMonth: 0 } };
  }
  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );
  const used = await prisma.aiUsageLog.count({
    where: {
      restaurantId,
      requestType: "image_gen",
      status: "ok",
      createdAt: { gte: monthStart },
    },
  });
  if (used >= limits.imagesPerMonth) {
    return {
      ok: false,
      reason: `وصلت حد الصور المولّدة الشهري (${limits.imagesPerMonth}) — رقِّ باقتك للمزيد`,
      usage: { importsUsed: 0, imagesUsedThisMonth: used },
    };
  }
  return { ok: true, usage: { importsUsed: 0, imagesUsedThisMonth: used } };
}

/** Fallback مسموح؟ — دائماً false (OpenRouter معطل) */
export async function allowFallback(): Promise<boolean> {
  return false;
}

/** رسالة ودية عند نفاد كل الحصص */
export function friendlyAiError(e: unknown): string {
  if (e instanceof Error && e.name === "GroqQuotaExhaustedError") {
    return "خدمة الذكاء الاصطناعي مشغولة حالياً — حاول بعد قليل أو غداً";
  }
  return "تعذّرت معالجة المنيو — حاول مجدداً بعد قليل";
}