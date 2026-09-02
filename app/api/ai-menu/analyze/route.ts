import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerRestaurant } from "@/lib/data";
import { getPlanLimits, friendlyAiError } from "@/lib/ai-menu/plan-limits";
import { analyzeMenu } from "@/lib/ai-menu/menu-analyzer";
import { getTempFile } from "@/lib/ai-menu/temp-storage";
import { imageSizeOf } from "@/lib/ai-menu/image-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai-menu/analyze — تحليل الصور المؤقتة بالـ AI (Groq).
 * خطوة واحدة طويلة (≤60s) — الصور inline base64.
 * عند النجاح: الأصناف تُحفظ WAITING_REVIEW — لا يُلمس المنيو الحقيقي.
 */
export async function POST(req: Request) {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) {
      return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 401 });
    }

    const body = (await req.json()) as { jobId?: string };
    if (!body.jobId) {
      return NextResponse.json({ ok: false, error: "jobId مطلوب" }, { status: 400 });
    }

    const job = await prisma.aiMenuImportJob.findUnique({
      where: { id: body.jobId },
    });
    if (!job || job.restaurantId !== restaurant.id) {
      return NextResponse.json({ ok: false, error: "الطلب غير موجود" }, { status: 404 });
    }
    if (job.status !== "UPLOADED") {
      return NextResponse.json(
        { ok: false, error: `حالة الطلب ${job.status} — التحليل متاح من UPLOADED فقط` },
        { status: 409 },
      );
    }

    const tempPaths =
      (job.tempFiles as { path: string }[] | null)?.map((t) => t.path) ?? [];
    if (tempPaths.length === 0) {
      return NextResponse.json({ ok: false, error: "لا ملفات مؤقتة" }, { status: 400 });
    }

    await prisma.aiMenuImportJob.update({
      where: { id: job.id },
      data: { status: "ANALYZING" },
    });

    try {
      const limits = await getPlanLimits(restaurant);

      // مسار الصور: inline base64
      const images: { mimeType: string; data: string; page: number }[] = [];
      for (let i = 0; i < tempPaths.length; i++) {
        console.log("[analyze] Loading temp file:", tempPaths[i]);
        const buf = await getTempFile(tempPaths[i]);
        console.log("[analyze] Loaded file size:", buf.length);
        const size = await imageSizeOf(buf);
        console.log("[analyze] Image size:", size);
        if (!size) continue;
        images.push({
          mimeType: "image/jpeg",
          data: buf.toString("base64"),
          page: i + 1,
        });
      }
      console.log("[analyze] Total images loaded:", images.length);
      if (images.length === 0) {
        throw new Error("لا صور صالحة للتحليل");
      }

      console.log("[analyze] Starting analysis for job:", job.id, "images:", images.length);
      
      const output = await analyzeMenu({
        jobId: job.id,
        restaurantId: restaurant.id,
        sourceType: "images",
        images,
        currencyHint: job.currency,
        limits,
      });

      console.log("[analyze] analyzeMenu succeeded:", { provider: output.provider, pageCount: output.pageCount });

      const saved = await import("@/lib/ai-menu/menu-analyzer").then((m) =>
        m.saveAnalysis(job.id, restaurant.id, output.menu, output.provider, output.pageCount),
      );

      console.log("[analyze] saveAnalysis succeeded:", saved);
      return NextResponse.json({
        ok: true,
        status: "WAITING_REVIEW",
        provider: output.provider,
        categoryCount: saved.categoryCount,
        itemCount: saved.itemCount,
      });
    } catch (e) {
      console.error("[ai-menu/analyze] FAILED:", e);
      console.error("[ai-menu/analyze] Error stack:", e instanceof Error ? e.stack : 'no stack');
      await prisma.aiMenuImportJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: friendlyAiError(e),
        },
      });
      return NextResponse.json(
        { ok: false, error: friendlyAiError(e) },
        { status: 503 },
      );
    }
  } catch (e) {
    console.error("[ai-menu/analyze]", e);
    return NextResponse.json(
      { ok: false, error: "حدث خطأ أثناء التحليل" },
      { status: 500 },
    );
  }
}