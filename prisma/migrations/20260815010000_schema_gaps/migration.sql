-- SEC-003: سدّ فجوات إعادة الإنتاج — كائنات وُجدت في قاعدة الإنتاج فقط
-- (أُنشئت خارج migrations عبر db push) ولم تكن migrations وحدها تعيد بناءها:
--  1) جدول MenuItemSize (المقاسات) + قيده الفريد + فهرسه + FK
--  2) عمود OrderItem.sizeCode
-- على قاعدة الإنتاج: idempotent بالكامل (IF NOT EXISTS / DO) — لا يغيّر شيئًا موجودًا.
-- على قاعدة جديدة: يبني الكائنات الناقصة فيتطابق المخطط مع schema.prisma.

CREATE TABLE IF NOT EXISTS "MenuItemSize" (
  "id"         TEXT NOT NULL,
  "sizeCode"   TEXT NOT NULL,
  "price"      DOUBLE PRECISION NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuItemSize_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MenuItemSize_menuItemId_sizeCode_key"
  ON "MenuItemSize"("menuItemId", "sizeCode");
CREATE INDEX IF NOT EXISTS "MenuItemSize_menuItemId_idx"
  ON "MenuItemSize"("menuItemId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'MenuItemSize_menuItemId_fkey'
                   AND connamespace = current_schema()::regnamespace) THEN
    ALTER TABLE "MenuItemSize" ADD CONSTRAINT "MenuItemSize_menuItemId_fkey"
      FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "sizeCode" TEXT;

-- أعمدة أُنشئت أيضًا خارج migrations (db push) في قاعدة الإنتاج:
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "discountPercentage" INTEGER;
ALTER TABLE "MenuItem" ADD COLUMN IF NOT EXISTS "sizeMode" TEXT NOT NULL DEFAULT 'letters';
