// (بلا حارس "server-only": يُستورد من سكربتات الفحص node أيضًا — الاستخدام في Next يقتصر
// على سياقات الخادم (Server Actions + Route Handlers) ولا يُستورد من أي مكوّن عميل)
import sharp from "sharp";

export type ImageMeta = { width: number; height: number; sizeKB: number };

/**
 * معالجة الصور إلزاميًا على الخادم قبل التخزين:
 * Resize (fit inside بلا تكبير) → WebP → لا يُخزَّن أصل ضخم أبدًا
 * حتى لو استُدعيت الواجهة بأي ملف صالح البايتات (العملاء يضغطون أيضًا
 * لتوفير النطاق، لكن الخادم هو الضامن).
 */
export async function processImageToWebp(
  bytes: Uint8Array | Buffer,
  opts: { maxDim: number; quality: number },
): Promise<{ buffer: Buffer; meta: ImageMeta }> {
  const image = sharp(bytes, { failOn: "error" })
    .rotate() // تطبيع اتجاه EXIF — الصور الملتقطة بالهاتف لا تظهر ملتوية
    .resize({
      width: opts.maxDim,
      height: opts.maxDim,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: opts.quality });
  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    meta: {
      width: info.width,
      height: info.height,
      sizeKB: Math.max(1, Math.round(info.size / 1024)),
    },
  };
}

/** ضغط صور المنيو: عرض أقصى 1600px — كافٍ لعرض القائمة وجودة موازنة الحجم */
export const MENU_IMAGE_OPTS = { maxDim: 1600, quality: 80 } as const;

/** ضغط الشعار: عرض أقصى 512px — يظهر صغيرًا في الهيرو/الفوتر */
export const LOGO_IMAGE_OPTS = { maxDim: 512, quality: 85 } as const;