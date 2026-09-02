-- DayStat: إجماليات يومية لكل مطعم (مصدر التقارير)
CREATE TABLE "DayStat" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "orders" INTEGER NOT NULL DEFAULT 0,
  "dineIn" INTEGER NOT NULL DEFAULT 0,
  "delivery" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DayStat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DayStat_restaurantId_date_key" ON "DayStat"("restaurantId", "date");
ALTER TABLE "DayStat" ADD CONSTRAINT "DayStat_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Table: طاولات المطعم (QR لكل طاولة)
CREATE TABLE "Table" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Table_restaurantId_number_key" ON "Table"("restaurantId", "number");
ALTER TABLE "Table" ADD CONSTRAINT "Table_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrderItem.itemId: مرجع الصنف لتقارير الأكثر مبيعًا
ALTER TABLE "OrderItem" ADD COLUMN "itemId" TEXT;
CREATE INDEX "OrderItem_itemId_idx" ON "OrderItem"("itemId");

-- Backfill: ربط عناصر الطلبات القديمة بالأصناف (بمطابقة الاسم داخل نفس المطعم)
UPDATE "OrderItem" oi
SET "itemId" = mi."id"
FROM "Order" o
JOIN "MenuItem" mi ON mi."restaurantId" = o."restaurantId"
WHERE oi."orderId" = o."id" AND oi."name" = mi."name";

-- Backfill: بناء DayStat لآخر 30 يومًا من الطلبات الموجودة (بتوقيت القاهرة)
INSERT INTO "DayStat" ("id", "restaurantId", "date", "revenue", "orders", "dineIn", "delivery")
SELECT gen_random_uuid()::text, "restaurantId",
       ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo')::date,
       SUM("total"), COUNT(*),
       COUNT(*) FILTER (WHERE "type" = 'dine-in'),
       COUNT(*) FILTER (WHERE "type" = 'delivery')
FROM "Order"
WHERE "createdAt" >= (CURRENT_DATE - INTERVAL '30 days')
GROUP BY "restaurantId", ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Cairo')::date
ON CONFLICT ("restaurantId", "date") DO NOTHING;
