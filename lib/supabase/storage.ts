import { storageDelete } from "./storage-rest";

const _BUCKET = "menu-images";

/** استخراج المسار داخل الـ bucket من رابط كامل أو مسار */
export function imagePathFromUrl(urlOrPath: string): string {
  const marker = "/storage/v1/object/public/menu-images/";
  const idx = urlOrPath.indexOf(marker);
  return idx >= 0 ? urlOrPath.slice(idx + marker.length) : urlOrPath;
}

/**
 * هل المسار مملوك لمستأجر معيّن؟ مسارات الرفع الجديدة تحمل بادئة
 * {items|logo}/{restaurantId}/... — أي مسار خارج البادئة (متوارث قديم،
 * بادئة مستأجر آخر، رابط خارجي) يُرفض للحذف: لا حذف عبر-المستأجرين أبدًا.
 * نقية وقابلة للاختبار.
 */
export function isTenantOwnedPath(urlOrPath: string | null | undefined, restaurantId: string): boolean {
  if (!urlOrPath || !restaurantId) return false;
  const path = imagePathFromUrl(urlOrPath);
  return (
    path.startsWith(`items/${restaurantId}/`) || path.startsWith(`logo/${restaurantId}/`)
  );
}

/** حذف صورة من Storage (لا يرمي الخطأ لأن التعدي اختياري) — عبر REST API */
export async function deleteImage(urlOrPath?: string | null) {
  if (!urlOrPath) return;
  const path = imagePathFromUrl(urlOrPath);
  if (!path) return;
  await storageDelete([path]);
}

/**
 * فحص سحر البايتات للصور (JPEG / PNG / WebP) — يرفض أي ملف انتحل
 * content-type مضللًا (مثلاً HTML/JS بامتداد صورة) حتى لو اجتاز التحقق الشكلي.
 */
export function isValidImageBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const h = (i: number) => bytes[i];
  const isJpeg =
    h(0) === 0xff && h(1) === 0xd8 && h(2) === 0xff;
  const isPng =
    h(0) === 0x89 && h(1) === 0x50 && h(2) === 0x4e && h(3) === 0x47 &&
    h(4) === 0x0d && h(5) === 0x0a && h(6) === 0x1a && h(7) === 0x0a;
  const isWebp =
    h(0) === 0x52 && h(1) === 0x49 && h(2) === 0x46 && h(3) === 0x46 &&
    h(8) === 0x57 && h(9) === 0x45 && h(10) === 0x42 && h(11) === 0x50;
  return isJpeg || isPng || isWebp;
}
