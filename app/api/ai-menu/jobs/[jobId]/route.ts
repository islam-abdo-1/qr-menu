import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerRestaurant } from "@/lib/data";
import { getActiveStyles } from "@/lib/ai-menu/style-service";
import { getPlanLimits } from "@/lib/ai-menu/plan-limits";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai-menu/jobs/[jobId] — حالة الطلب + الأصناف للمراجعة.
 * GET بدون jobId غير مدعوم — استخدم /api/ai-menu/jobs (قائمة).
 */
export async function GET(
  _req: Request,
  { params }: { params: { jobId: string } },
) {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) {
      return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 401 });
    }

    const job = await prisma.aiMenuImportJob.findUnique({
      where: { id: params.jobId },
      include: {
        items: {
          orderBy: [{ categoryOrder: "asc" }, { sourceOrder: "asc" }],
        },
      },
    });
    if (!job || job.restaurantId !== restaurant.id) {
      return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });
    }

    const limits = await getPlanLimits(restaurant);
    const styles = await getActiveStyles(limits.styleCount);

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        status: job.status,
        sourceType: job.sourceType,
        imageMode: job.imageMode,
        currency: job.currency,
        detectedCategoryCount: job.detectedCategoryCount,
        detectedItemCount: job.detectedItemCount,
        extractedImageCount: job.extractedImageCount,
        generatedImageCount: job.generatedImageCount,
        failedImageCount: job.failedImageCount,
        errorMessage: job.errorMessage,
        providerUsed: job.providerUsed,
        createdAt: job.createdAt,
        expiresAt: job.expiresAt,
      },
      items: job.items,
      styles,
      planLabel: limits.planLabel,
      limits: {
        imagesPerMonth: limits.imagesPerMonth,
        maxPages: limits.maxPages,
        allowPinterestRefs: limits.allowPinterestRefs,
      },
    });
  } catch (e) {
    console.error("[ai-menu/job GET]", e);
    return NextResponse.json(
      { ok: false, error: "تعذّر تحميل الطلب" },
      { status: 500 },
    );
  }
}

/** DELETE /api/ai-menu/jobs/[jobId] — حذف الطلب + تنظيف المؤقت (بند 49) */
export async function DELETE(
  _req: Request,
  { params }: { params: { jobId: string } },
) {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) {
      return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 401 });
    }
    const job = await prisma.aiMenuImportJob.findUnique({
      where: { id: params.jobId },
      select: { id: true, restaurantId: true, status: true },
    });
    if (!job || job.restaurantId !== restaurant.id) {
      return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });
    }

    const { cleanupJob } = await import("@/lib/ai-menu/temp-storage");
    await cleanupJob(job.id);
    await prisma.aiMenuImportJob.delete({ where: { id: job.id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai-menu/job DELETE]", e);
    return NextResponse.json(
      { ok: false, error: "تعذّر حذف الطلب" },
      { status: 500 },
    );
  }
}

type ReviewItemInput = {
  id: string;
  name?: string;
  description?: string | null;
  price?: number | null;
  categoryName?: string;
  categoryType?: string | null;
  variants?: { name: string; price: number }[] | null;
  imageModeOverride?: "original" | "generate" | "none" | null;
  remove?: boolean;
  regenerateImage?: boolean;
};

/**
 * PATCH /api/ai-menu/jobs/[jobId] — حفظ تعديلات المراجعة + نمط الصور العام.
 * المالك يعدّل الأسماء/الأسعار/الأقسام/نمط الصورة قبل الاستيراد (بند 36-39).
 */
export async function PATCH(
  req: Request,
  { params }: { params: { jobId: string } },
) {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) {
      return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 401 });
    }

    const job = await prisma.aiMenuImportJob.findUnique({
      where: { id: params.jobId },
      select: { id: true, restaurantId: true, status: true },
    });
    if (!job || job.restaurantId !== restaurant.id) {
      return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });
    }
    if (job.status !== "WAITING_REVIEW" && job.status !== "GENERATING") {
      return NextResponse.json(
        { ok: false, error: "المراجعة متاحة في حالة WAITING_REVIEW فقط" },
        { status: 409 },
      );
    }

    const body = (await req.json()) as {
      items?: ReviewItemInput[];
      imageMode?: "SMART" | "MENU_ONLY" | "AI_ONLY";
    };

    if (body.imageMode && ["SMART", "MENU_ONLY", "AI_ONLY"].includes(body.imageMode)) {
      await prisma.aiMenuImportJob.update({
        where: { id: job.id },
        data: { imageMode: body.imageMode },
      });
    }

    let updated = 0;
    for (const input of body.items ?? []) {
      const existing = await prisma.aiMenuImportItem.findUnique({
        where: { id: input.id },
        select: { id: true, restaurantId: true, jobId: true },
      });
      if (!existing || existing.restaurantId !== restaurant.id || existing.jobId !== job.id) {
        continue; // تجاهل الغريب — لا تسريب عبر المطاعم (بند 46)
      }

      if (input.remove) {
        await prisma.aiMenuImportItem.delete({ where: { id: input.id } });
        updated++;
        continue;
      }

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name.trim().slice(0, 120);
      if (input.description !== undefined) {
        data.description = input.description?.trim().slice(0, 400) || null;
      }
      if (input.price !== undefined) {
        data.price = input.price !== null && input.price > 0 ? input.price : null;
        if (data.price !== null) {
          const cur = await prisma.aiMenuImportItem.findUnique({
            where: { id: input.id },
            select: { reviewReasons: true },
          });
          const reasons =
            (cur?.reviewReasons as string[] | null)?.filter(
              (r) => r !== "price_unclear",
            ) ?? [];
          data.reviewReasons = reasons.length > 0 ? (reasons as unknown as object) : undefined;
          data.needsReview = reasons.length > 0;
        }
      }
      if (input.categoryName !== undefined) {
        data.categoryName = input.categoryName.trim().slice(0, 60);
      }
      if (input.categoryType !== undefined) {
        data.categoryType = input.categoryType;
        data.categoryConfidence = 1; // يدوي = واثق
      }
      if (input.variants !== undefined) {
        data.variants =
          input.variants && input.variants.length > 0
            ? (input.variants as unknown as object)
            : undefined;
      }
      if (input.imageModeOverride !== undefined) {
        data.imageModeOverride = input.imageModeOverride;
        if (input.imageModeOverride === "generate") {
          data.generationStatus = "PENDING";
          data.imageSource = "NONE";
        }
        if (input.imageModeOverride === "none") {
          data.generationStatus = "SKIPPED";
          data.imageSource = "NONE";
          data.imageDetected = false;
        }
        if (input.imageModeOverride === "original") {
          data.generationStatus = "SKIPPED";
        }
      }
      if (input.regenerateImage) {
        data.generationStatus = "PENDING";
        data.imageSource = "NONE";
        data.imageModeOverride = "generate";
        data.generationError = null;
        data.finalImageUrl = null;
      }

      if (Object.keys(data).length > 0) {
        await prisma.aiMenuImportItem.update({ where: { id: input.id }, data });
        updated++;
      }
    }

    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    console.error("[ai-menu/review PATCH]", e);
    return NextResponse.json(
      { ok: false, error: "تعذّر حفظ التعديلات" },
      { status: 500 },
    );
  }
}
