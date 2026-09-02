import "server-only";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { MENU_TAG } from "@/lib/data";
import { cleanupJob } from "./temp-storage";
import { imageSizeOf } from "./image-service";

/**
 * الاستيراد النهائي — يحوّل الأصناف المُراجَعة إلى المنيو الحقيقي:
 * Category + MenuItem + MenuItemSize (المقاسات = نظام الـ variants الموجود).
 * Idempotent: كل صنف AI يُستورد مرة واحدة (importedMenuItemId CAS).
 * بعد النجاح: تنظيف الملفات المؤقتة (البند 49) + revalidate المنيو.
 */

export type ImportResult = {
  categoriesCreated: number;
  itemsCreated: number;
  imagesAttached: number;
  warnings: string[];
};

export async function importMenu(
  jobId: string,
  restaurantId: string,
): Promise<ImportResult> {
  const job = await prisma.aiMenuImportJob.findUnique({
    where: { id: jobId },
    include: { items: { orderBy: [{ categoryOrder: "asc" }, { sourceOrder: "asc" }] } },
  });
  if (!job || job.restaurantId !== restaurantId) {
    throw new Error("طلب الاستيراد غير موجود");
  }
  if (job.status === "COMPLETED") {
    throw new Error("تم استيراد هذا الطلب مسبقاً");
  }
  if (job.status !== "WAITING_REVIEW" && job.status !== "GENERATING") {
    throw new Error("حالة الطلب لا تسمح بالاستيراد");
  }

  const warnings: string[] = [];
  const result: ImportResult = {
    categoriesCreated: 0, itemsCreated: 0, imagesAttached: 0, warnings,
  };

  // تجميع الأقسام بالترتيب
  const categoryOrder: string[] = [];
  const catByName = new Map<string, { type: string | null; order: number }>();
  for (const item of job.items) {
    if (!catByName.has(item.categoryName)) {
      catByName.set(item.categoryName, {
        type: item.categoryType, order: item.categoryOrder,
      });
      categoryOrder.push(item.categoryName);
    }
  }

  // معالجة تسلسلية آمنة — كل صنف idempotent
  for (const catName of categoryOrder) {

    // القسم: موجود؟ استخدمه. غير موجود؟ أنشئه (بنفس المطعم فقط).
    let category = await prisma.category.findFirst({
      where: { restaurantId, name: catName },
      select: { id: true },
    });
    if (!category) {
      const maxSort = await prisma.category.aggregate({
        where: { restaurantId },
        _max: { sortOrder: true },
      });
      category = await prisma.category.create({
        data: {
          restaurantId,
          name: catName,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
        select: { id: true },
      });
      result.categoriesCreated++;
    }

    const catItems = job.items.filter((i) => i.categoryName === catName);

    for (const item of catItems) {
      // CAS idempotent: صنف AI يُستورد مرة واحدة فقط
      const claim = await prisma.aiMenuImportItem.updateMany({
        where: { id: item.id, importedMenuItemId: null },
        data: { importedMenuItemId: "PENDING" },
      });
      if (claim.count === 0) continue; // استُورد سابقاً

      try {
        // تحضير المقاسات (نظام MenuItemSize الموجود)
        const variants =
          (item.variants as { name: string; price: number }[] | null) ?? [];
        const hasVariants = variants.length > 0;
        const basePrice =
          item.price ??
          (hasVariants ? Math.min(...variants.map((v) => v.price)) : null);

        if (basePrice === null || basePrice <= 0) {
          // بند 35: بلا سعر → لا استيراد صامت — تحذير وتخطي
          warnings.push(
            `«${item.name}» تخطّي — السعر غير واضح، عدّله من المراجعة ثم أعد الاستيراد`,
          );
          await prisma.aiMenuImportItem.update({
            where: { id: item.id },
            data: { importedMenuItemId: null, needsReview: true },
          });
          continue;
        }

        const menuItem = await prisma.menuItem.create({
          data: {
            restaurantId,
            categoryId: category.id,
            name: item.name,
            description: item.description,
            price: basePrice,
            imageUrl: item.finalImageUrl,
            imageWidth: (item.finalImageMeta as { width?: number } | null)?.width ?? null,
            imageHeight: (item.finalImageMeta as { height?: number } | null)?.height ?? null,
            imageSizeKB: (item.finalImageMeta as { sizeKB?: number } | null)?.sizeKB ?? null,
            isAvailable: true,
            sizeMode: item.sizeMode === "weight" ? "weight" : "letters",
            discountPercentage: null,
            sizes: hasVariants
              ? {
                  create: variants.map((v) => ({
                    sizeCode: v.name.slice(0, 12),
                    price: v.price > 0 ? v.price : basePrice,
                  })),
                }
              : undefined,
          },
          select: { id: true },
        });

        await prisma.aiMenuImportItem.update({
          where: { id: item.id },
          data: { importedMenuItemId: menuItem.id },
        });
        result.itemsCreated++;
        if (item.finalImageUrl) result.imagesAttached++;
      } catch (e) {
        // فشل صنف واحد لا يوقف الباقي (بند 42 — partial success)
        const msg = e instanceof Error ? e.message : "خطأ غير معروف";
        warnings.push(`«${item.name}» فشل الاستيراد: ${msg}`);
        await prisma.aiMenuImportItem.update({
          where: { id: item.id },
          data: { importedMenuItemId: null, generationError: msg.slice(0, 200) },
        });
      }
    }
  }

  // إن كانت هناك صور نهائية بلا meta — املأ الأبعاد (احتياطي)
  const itemsWithUrlNoMeta = await prisma.aiMenuImportItem.findMany({
    where: { jobId, finalImageUrl: { not: null } },
    select: { id: true, finalImageUrl: true },
  });
  for (const it of itemsWithUrlNoMeta) {
    const meta = await prisma.aiMenuImportItem.findUnique({
      where: { id: it.id },
      select: { finalImageMeta: true },
    });
    if (!meta?.finalImageMeta && it.finalImageUrl) {
      try {
        const res = await fetch(it.finalImageUrl, { cache: "no-store" });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const size = await imageSizeOf(buf);
          if (size) {
            await prisma.aiMenuImportItem.update({
              where: { id: it.id },
              data: {
                finalImageMeta: {
                  width: size.width, height: size.height,
                  sizeKB: Math.max(1, Math.round(buf.length / 1024)),
                } as unknown as object,
              },
            });
          }
        }
      } catch {
        // احتياطي غير حرج
      }
    }
  }

  // إنهاء الطلب + تنظيف الملفات المؤقتة (البند 49)
  await prisma.aiMenuImportJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  try {
    await cleanupJob(jobId);
    await prisma.aiMenuImportJob.update({
      where: { id: jobId },
      data: { status: "CLEANED" },
    });
  } catch (e) {
    console.error("[import] cleanup failed (غير حرج):", e);
  }

  // تحديث المنيو العام فوراً (نفس آلية اللوحة الحالية)
  revalidateTag(MENU_TAG);

  return result;
}
