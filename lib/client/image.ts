/** أدوات معالجة الصور على جانب المتصفح — ضغط إلى WebP قبل الرفع */

export function readFileAsImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذّر قراءة الصورة"));
    };
    img.src = url;
  });
}

/**
 * ضغط ذكي:
 * - يُصغّر الصور الكبيرة إلى 800px كحد أقصى (كفاية لعرض الكروت والجوالات)
 * - يحوّل كل الصيغ إلى WebP (أصغر حجم بنفس الجودة) أو JPEG كحل بديل
 * - يمنع رفع صور ضخمة تبطئ المنيو العام
 */
export async function compressToWebp(
  file: File,
  maxDim = 800,
  quality = 0.82,
): Promise<{ blob: Blob; width: number; height: number; originalSize: number }> {
  const img = await readFileAsImage(file);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("لا يدعم المتصفح الرسم على Canvas");
  ctx.drawImage(img, 0, 0, width, height);

  const toBlob = (type: string): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, type, quality));

  // نجرب WebP أولًا ثم نتراجع إلى JPEG
  const webp = await toBlob("image/webp");
  if (webp) return { blob: webp, width, height, originalSize: file.size };
  const jpeg = await toBlob("image/jpeg");
  if (jpeg) return { blob: jpeg, width, height, originalSize: file.size };
  throw new Error("تعذّر ضغط الصورة");
}

/** تنسيق الحجم بالأرقام المقروءة (KB / MB) */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}