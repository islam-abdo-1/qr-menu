-- بيانات تعريف الصور المضغوطة — URL يبقى الناقل الوحيد للصورة، والأعمدة تحفظ الأبعاد والحجم
-- (قيم nullable: الصور القديمة الرفعة قبل هذا التحسين تبقى بلا بيانات تعريف)
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "imageWidth" INTEGER;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "imageHeight" INTEGER;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "imageSizeKB" INTEGER;

ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "logoWidth" INTEGER;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "logoHeight" INTEGER;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "logoSizeKB" INTEGER;
