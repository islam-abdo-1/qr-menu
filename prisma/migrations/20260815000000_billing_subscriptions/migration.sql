-- الفوترة: أسبوع مجاني + اشتراكات شهرية/سنوية + استثناء «أبو الذهب» نهائيًا

ALTER TABLE "Restaurant"
  ADD COLUMN "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "paidUntil" TIMESTAMP(3),
  ADD COLUMN "billingExempt" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'monthly',
    "method" TEXT NOT NULL DEFAULT 'manual',
    "paymobRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_paymobRef_key" ON "Payment"("paymobRef");
CREATE INDEX "Payment_restaurantId_createdAt_idx" ON "Payment"("restaurantId", "createdAt" DESC);

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- فترة مجانية 7 أيام لكل مطعم قائم (بدون اشتراك سابق)
UPDATE "Restaurant"
SET "trialEndsAt" = NOW() + INTERVAL '7 days'
WHERE "trialEndsAt" IS NULL AND "paidUntil" IS NULL AND "billingExempt" = false;

-- استثناء نهائي من الفوترة لمطعم «أبو الذهب»
UPDATE "Restaurant" SET "billingExempt" = true WHERE "slug" IN ('kafy');

-- مفتاح تشغيل/إيقاف الفوترة من لوحة المالك (إيقاف حتى تفعيل Paymob)
INSERT INTO "SiteSetting" ("key", "value") VALUES ('billingEnabled', 'false')
ON CONFLICT ("key") DO NOTHING;
