import sharp from "sharp";
import { processImageToWebp, MENU_IMAGE_OPTS, LOGO_IMAGE_OPTS } from "../lib/image";

async function main() {
  // صورة اختبار 4000x3000 (أصل ضخم) ملوّنة عشوائيًا
  const raw = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: { r: 180, g: 90, b: 40 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
  console.log(`الإدخال: ${raw.length} بايت (${(raw.length / 1024 / 1024).toFixed(1)}MB)`);

  const menu = await processImageToWebp(raw, MENU_IMAGE_OPTS);
  console.log(
    `منيو: ${menu.buffer.length} بايت (${(menu.buffer.length / 1024).toFixed(0)}KB)`,
    `الأبعاد: ${menu.meta.width}x${menu.meta.height}`,
  );
  if (menu.meta.width > MENU_IMAGE_OPTS.maxDim) throw new Error("لم يُصغَّر العرض");

  const logo = await processImageToWebp(raw, LOGO_IMAGE_OPTS);
  console.log(
    `شعار: ${logo.buffer.length} بايت (${(logo.buffer.length / 1024).toFixed(0)}KB)`,
    `الأبعاد: ${logo.meta.width}x${logo.meta.height}`,
  );
  if (logo.meta.width > LOGO_IMAGE_OPTS.maxDim) throw new Error("الشعار لم يُصغَّر");

  // صور صغيرة تبقى بحجمها (بلا تكبير)
  const small = await sharp({ create: { width: 100, height: 80, channels: 3, background: "red" } })
    .png()
    .toBuffer();
  const smallOut = await processImageToWebp(small, MENU_IMAGE_OPTS);
  if (smallOut.meta.width !== 100 || smallOut.meta.height !== 80)
    throw new Error("صغيرة كُبِّرت — بدونEnlargement فشل");

  // ملف غير صورة يجب أن يفشل
  try {
    await processImageToWebp(Buffer.from("not an image at all"), MENU_IMAGE_OPTS);
    throw new Error("قُبل ملف غير صورة!");
  } catch {
    console.log("ملف غير صورة: رُفض ✓");
  }

  console.log("✔ معالجة الصور تعمل كما هو مطلوب");
}

main().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});