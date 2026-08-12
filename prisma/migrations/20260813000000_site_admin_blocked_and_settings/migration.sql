-- Restaurant.blocked: حظر مؤقت من لوحة المالك (يوقف لوحة الأدمن والموظفين، المنيو العام يعمل)
ALTER TABLE "Restaurant" ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false;

-- SiteSetting: إعدادات عامة للمنصة (key/value) — تُعدَّل من لوحة المالك
CREATE TABLE "SiteSetting" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SiteSetting_key_key" ON "SiteSetting"("key");

-- قيم البداية: الحد المجاني 25 مطعمًا + فتح التسجيل (تعديلهما من لوحة المالك)
INSERT INTO "SiteSetting" ("key", "value") VALUES
  ('maxRestaurants', '25'),
  ('signupOpen', 'true')
ON CONFLICT ("key") DO NOTHING;