-- Tenant: نظام متعدد المطاعم (Restaurant) + جداول التفضيلات والطلبات.
-- البيانات الموجودة تُنسب للمطعم المالك (كافي أبو القوة) قبل فرض NOT NULL.

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "staffPin" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_ownerId_key" ON "Restaurant"("ownerId");

-- المطعم المالك الحالي: كافي أبو القوة (userId الخاص بالأدمن في Supabase)
INSERT INTO "Restaurant" ("id", "slug", "name", "ownerId", "staffPin")
VALUES ('rest_owner', 'kafy', 'كافي أبو القوة', '776f1f9d-0749-47c9-a629-dd58677acbbe', '2481');

-- AlterTable — إضافة restaurantId كاختياري أولًا ثم التعبئة ثم فرض الإلزام
ALTER TABLE "Setting"  ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "Category" ADD COLUMN "restaurantId" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "restaurantId" TEXT;

UPDATE "Setting"  SET "restaurantId" = 'rest_owner';
UPDATE "Category" SET "restaurantId" = 'rest_owner';
UPDATE "MenuItem" SET "restaurantId" = 'rest_owner';

ALTER TABLE "Setting"  ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "restaurantId" SET NOT NULL;
ALTER TABLE "MenuItem" ALTER COLUMN "restaurantId" SET NOT NULL;

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "tableNo" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "qty" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_itemId_key" ON "Favorite"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_number_key" ON "Order"("restaurantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_restaurantId_key" ON "Setting"("restaurantId");

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
