import "server-only";
import sharp from "sharp";
import { storageUpload, storagePublicUrl } from "@/lib/supabase/storage-rest";
import { prisma } from "@/lib/prisma";

/**
 * أبعاد صورة من Buffer — عبر Sharp الموجود (لا اعتماديات جديدة)
 */
export async function imageSizeOf(
  buf: Buffer,
): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(buf).metadata();
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
  } catch {
    return null;
  }
}

/**
 * معالجة صور المنيو إلزاميًا على الخادم قبل التخزين:
 * Resize (fit inside بلا تكبير) → WebP → لا يُخزَّن أصل ضخم أبدًا
 * حتى لو استُدعيت الواجهة بأي ملف صالح البايتات (العملاء يضغطون أيضًا
 * لتوفير النطاق، لكن الخادم هو الضامن).
 * يُولِّد أيضاً blurDataURL (20x20, heavy blur) للـ LQIP placeholder.
 */
export async function processImageToWebp(
  bytes: Buffer,
  opts: { maxDim: number; quality: number },
): Promise<{ buffer: Buffer; meta: { width: number; height: number; sizeKB: number }; blurDataURL: string }> {
  const [mainResult, blurResult] = await Promise.all([
    sharp(bytes, { failOn: "error" })
      .rotate()
      .resize({
        width: opts.maxDim,
        height: opts.maxDim,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: opts.quality })
      .toBuffer({ resolveWithObject: true }),
    sharp(bytes)
      .rotate()
      .resize(20, 20, { fit: "inside" })
      .blur(30)
      .webp({ quality: 20 })
      .toBuffer({ resolveWithObject: true }),
  ]);

  const blurDataURL = `data:image/webp;base64,${blurResult.data.toString("base64")}`;

  return {
    buffer: mainResult.data,
    meta: {
      width: mainResult.info.width,
      height: mainResult.info.height,
      sizeKB: Math.max(1, Math.round(mainResult.info.size / 1024)),
    },
    blurDataURL,
  };
}

/** ضغط صور المنيو: عرض أقصى 1600px — كافٍ لعرض القائمة وجودة موازنة الحجم */
export const MENU_IMAGE_OPTS = { maxDim: 1600, quality: 80 } as const;

/** ضغط الشعار: عرض أقصى 512px — يظهر صغيرًا في الهيرو/الفوتر */
export const LOGO_IMAGE_OPTS = { maxDim: 512, quality: 85 } as const;

/**
 * استخراج صورة صنف من الصفحة الأصلية للمنيو (صورة)
 * يستخدم area المحددة في imageRegion للقص
 */
export async function extractOriginalImage(
  itemId: string,
  restaurantId: string,
  pageFile: { mimeType: string; data: string },
): Promise<{ ok: boolean; imageUrl?: string; error?: string }> {
  try {
    // جلب بيانات الصنف للحصول على imageRegion
    const item = await prisma.aiMenuImportItem.findUnique({
      where: { id: itemId },
      select: { imageRegion: true, imagePage: true },
    });

    if (!item?.imageRegion) {
      return { ok: false, error: "No imageRegion found for item" };
    }

    const pageBuffer = Buffer.from(pageFile.data, "base64");

    // نتعامل مع الصور فقط - للـ PDF نحتاج pdf-to-png
    if (pageFile.mimeType === "application/pdf") {
      return { ok: false, error: "PDF extraction not yet implemented" };
    }

    // الحصول على أبعاد الصورة الأصلية
    const meta = await sharp(pageBuffer).metadata();
    if (!meta.width || !meta.height) {
      return { ok: false, error: "Invalid image metadata" };
    }

    // تحويل imageRegion (إحداثيات طبيعية 0-1) إلى بكسلز
    const region = item.imageRegion as { x: number; y: number; w: number; h: number };
    const left = Math.max(0, Math.round(region.x * meta.width));
    const top = Math.max(0, Math.round(region.y * meta.height));
    const width = Math.min(meta.width - left, Math.round(region.w * meta.width));
    const height = Math.min(meta.height - top, Math.round(region.h * meta.height));

    // التحقق من صلاحية المنطقة
    if (width <= 0 || height <= 0) {
      return { ok: false, error: "Invalid imageRegion dimensions" };
    }

    // قص المنطقة المحددة ثم معالجة
    const cropped = sharp(pageBuffer)
      .extract({ left, top, width, height })
      .rotate() // تطبيع EXIF
      .resize({
        width: MENU_IMAGE_OPTS.maxDim,
        height: MENU_IMAGE_OPTS.maxDim,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: MENU_IMAGE_OPTS.quality });

    const { data, info } = await cropped.toBuffer({ resolveWithObject: true });
    const processedBuffer = data;

    // Generate blurDataURL for LQIP
    const blurBuffer = await sharp(processedBuffer)
      .resize(20, 20, { fit: "inside" })
      .blur(30)
      .webp({ quality: 20 })
      .toBuffer();
    const blurDataURL = `data:image/webp;base64,${blurBuffer.toString("base64")}`;

    const fileName = `${restaurantId}/menu-items/${itemId}-original-${Date.now()}.webp`;

    const uploadResult = await storageUpload(fileName, processedBuffer, "image/webp");
    if (!uploadResult.ok) {
      console.error("[extractOriginalImage] Upload error:", uploadResult.error);
      return { ok: false, error: uploadResult.error };
    }

    const publicUrl = storagePublicUrl(fileName);

    // تحديث الصنف برابط الصورة + meta + blurDataURL
    await prisma.aiMenuImportItem.update({
      where: { id: itemId },
      data: {
        finalImageUrl: publicUrl,
        generationStatus: "COMPLETED",
        imageSource: "MENU_ORIGINAL",
        finalImageMeta: {
          width: info.width,
          height: info.height,
          sizeKB: Math.max(1, Math.round(info.size / 1024)),
          blurDataURL,
        } as unknown as object,
      },
    });

    return { ok: true, imageUrl: publicUrl };
  } catch (e) {
    console.error("[extractOriginalImage] Error:", e);
    return { ok: false, error: String(e) };
  }
}

/**
 * استخراج نص من صورة باستخدام OCR.space (مجاني - 500 طلب/يوم)
 * يعيد النص المستخرج أو null عند الفشل
 */
export async function extractTextFromImage(
  imageBuffer: Buffer,
  language: string = "eng"
): Promise<string | null> {
  try {
    const base64 = imageBuffer.toString("base64");
    const FormData = (await import("form-data")).default;
    const fetch = (await import("node-fetch")).default;

    const form = new FormData();
    form.append("base64Image", `data:image/jpeg;base64,${base64}`);
    form.append("language", language);
    form.append("isOverlayRequired", "false");
    form.append("apikey", "helloworld"); // Free tier key

    console.log("[OCR] Sending request to OCR.space...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form,
      headers: form.getHeaders ? form.getHeaders() : {},
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    console.log("[OCR] Response status:", res.status);
    const data = await res.json() as {
      IsErroredOnProcessing: boolean;
      ErrorMessage?: string[];
      ParsedResults?: Array<{ ParsedText?: string }>;
    };

    if (data.IsErroredOnProcessing) {
      console.warn("[OCR] Processing error:", data.ErrorMessage);
      return null;
    }

    const text = data.ParsedResults?.[0]?.ParsedText;
    console.log("[OCR] Extracted text length:", text?.length || 0);
    return text?.trim() || null;
  } catch (e) {
    console.error("[OCR] Error:", e);
    return null;
  }
}