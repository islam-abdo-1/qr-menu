import { createClient } from "./server";

const BUCKET = "menu-images";

/** استخراج المسار داخل الـ bucket من رابط كامل أو مسار */
export function imagePathFromUrl(urlOrPath: string): string {
  const marker = "/storage/v1/object/public/menu-images/";
  const idx = urlOrPath.indexOf(marker);
  return idx >= 0 ? urlOrPath.slice(idx + marker.length) : urlOrPath;
}

/** حذف صورة من Storage (لا يرمي الخطأ لأن التعدي اختياري) */
export async function deleteImage(urlOrPath?: string | null) {
  if (!urlOrPath) return;
  const path = imagePathFromUrl(urlOrPath);
  if (!path) return;
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([path]);
}