-- SEC-003: محاذاة مخطط قاعدة الإنتاج مع prisma/schema.prisma (إزالة الانجراف)
-- أعمدة id الستة أُنشئت TEXT في migrations الأصلية بينما المخطط يعلن uuid —
-- تحقّق مسبق: كل القيم المخزنة بصيغة uuid صالحة (0 قيمة غير مطابقة) فالتحويل آمن.
-- الخطوات: إسقاط FK المؤثرة مؤقتًا → تحويل الأنواع → إعادة إنشائها بنفس السلوك
-- (DELETE/UPDATE CASCADE كما كانت). إعادة التشغيل idempotent بالكامل (IF EXISTS/DO).

ALTER TABLE "MenuItem"    DROP CONSTRAINT IF EXISTS "MenuItem_categoryId_fkey";
ALTER TABLE "MenuItemSize" DROP CONSTRAINT IF EXISTS "MenuItemSize_menuItemId_fkey";
ALTER TABLE "Favorite"    DROP CONSTRAINT IF EXISTS "Favorite_itemId_fkey";
ALTER TABLE "OrderItem"   DROP CONSTRAINT IF EXISTS "OrderItem_orderId_fkey";

ALTER TABLE "Category"    ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "MenuItem"    ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "MenuItemSize" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "Favorite"    ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "Order"       ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "OrderItem"   ALTER COLUMN "id" TYPE UUID USING "id"::uuid;

-- أعمدة FK المشيرة يجب أن تطابق نوع المرجع (قيمها كلها صالحة uuid لأنها تشير إلى مفاتيح أعلاه)
ALTER TABLE "MenuItem"    ALTER COLUMN "categoryId" TYPE UUID USING "categoryId"::uuid;
ALTER TABLE "MenuItemSize" ALTER COLUMN "menuItemId" TYPE UUID USING "menuItemId"::uuid;
ALTER TABLE "Favorite"    ALTER COLUMN "itemId" TYPE UUID USING "itemId"::uuid;
ALTER TABLE "OrderItem"   ALTER COLUMN "orderId" TYPE UUID USING "orderId"::uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MenuItem_categoryId_fkey' AND connamespace = current_schema()::regnamespace) THEN
    ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MenuItemSize_menuItemId_fkey' AND connamespace = current_schema()::regnamespace) THEN
    ALTER TABLE "MenuItemSize" ADD CONSTRAINT "MenuItemSize_menuItemId_fkey"
      FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Favorite_itemId_fkey' AND connamespace = current_schema()::regnamespace) THEN
    ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_orderId_fkey' AND connamespace = current_schema()::regnamespace) THEN
    ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
