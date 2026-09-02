import { NextResponse } from "next/server";
import { getOwnerRestaurant } from "@/lib/data";
import { importMenu } from "@/lib/ai-menu/import-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai-menu/import — الاستيراد النهائي للمنيو الحقيقي (بند 35).
 * بعد مراجعة المالك: Category + MenuItem + MenuItemSize في معاملة صنف-بصنف
 * (partial success — بند 42) + تنظيف مؤقت + revalidate المنيو العام.
 */
export async function POST(
  req: Request,
  { params }: { params: { jobId: string } },
) {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) {
      return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 401 });
    }

    // منع النقر المزدوج على مستوى الطلب
    const body = (await req.json().catch(() => ({}))) as { confirm?: boolean };
    if (body.confirm !== true) {
      return NextResponse.json(
        { ok: false, error: "تأكيد الاستيراد مطلوب (confirm: true)" },
        { status: 400 },
      );
    }

    const result = await importMenu(params.jobId, restaurant.id);

    return NextResponse.json({
      ok: true,
      categoriesCreated: result.categoriesCreated,
      itemsCreated: result.itemsCreated,
      imagesAttached: result.imagesAttached,
      warnings: result.warnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل الاستيراد";
    console.error("[ai-menu/import]", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
