-- SEC-002: مفتاح تفرد الطلبات من العميل (cartNonce) + عدّاد صارم لنافذة الطلبات
-- كل الأوامر idempotent (IF NOT EXISTS) — آمنة لإعادة التنفيذ.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cartNonce" VARCHAR(64);

-- تفرد race-safe على مستوى القاعدة: (restaurantId, cartNonce)
-- القيم NULL مسموح بتعددها في PostgreSQL — الطلبات بلا nonce غير متقيدة بسلوك النونس
CREATE UNIQUE INDEX IF NOT EXISTS "Order_restaurantId_cartNonce_key"
  ON "Order"("restaurantId", "cartNonce");

-- عدّاد نافذة الطلبات: تحديث ذري واحد (ON CONFLICT ... DO UPDATE) مع RETURNING
-- يمنع تجاوز الحد عبر الإرسال المتوازي (upsert يمتلك قفل الصف)
CREATE TABLE IF NOT EXISTS "OrderWindow" (
  "restaurantId" TEXT NOT NULL,
  "windowStart"  TIMESTAMPTZ(3) NOT NULL,
  "count"        INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OrderWindow_pkey" PRIMARY KEY ("restaurantId","windowStart")
);