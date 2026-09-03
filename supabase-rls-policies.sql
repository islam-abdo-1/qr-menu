-- =============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
-- تشغيل في Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- =============================================================================

-- 1. تفعيل RLS على جميع الجداول
ALTER TABLE "Restaurant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Setting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuItemSize" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderWindow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DayStat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Table" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OwnerLoginAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteSetting" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- دوال مساعدة (Helper Functions)
-- =============================================================================

-- دالة للحصول على restaurant_id من JWT claims (supabase.auth.get_user())
-- يعمل مع Clerk/Supabase Auth حيث user_id = ownerId
CREATE OR REPLACE FUNCTION get_current_restaurant_id()
RETURNS TEXT AS $$
DECLARE
  v_user_id TEXT;
  v_restaurant_id TEXT;
BEGIN
  -- محاولة الحصول على user_id من JWT
  v_user_id := auth.uid()::TEXT;
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- البحث عن المطعم المرتبط بهذا المالك
  SELECT id INTO v_restaurant_id
  FROM "Restaurant"
  WHERE "ownerId" = v_user_id
  LIMIT 1;
  
  RETURN v_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة للتحقق من ملكية المطعم (للمالك)
CREATE OR REPLACE FUNCTION is_restaurant_owner(p_restaurant_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_current_restaurant_id() = p_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة للتحقق من صلاحية الموظفين (staff pin)
-- ملاحظة: الموظفين يدخلون بـ staffPin مشترك، وليس بمستخدمين منفصلين
-- هذه الدالة تستخدم في API routes وليس في RLS مباشرة
CREATE OR REPLACE FUNCTION verify_staff_access(p_restaurant_id TEXT, p_pin TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_pin TEXT;
BEGIN
  SELECT "staffPin" INTO v_pin
  FROM "Restaurant"
  WHERE id = p_restaurant_id
  LIMIT 1;
  
  RETURN v_pin = p_pin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- سياسات Restaurant (المالك فقط)
-- =============================================================================

-- المالك يرى مطعمه فقط
CREATE POLICY "restaurant_owner_select" ON "Restaurant"
  FOR SELECT USING (is_restaurant_owner(id));

-- المالك يحدث مطعمه فقط
CREATE POLICY "restaurant_owner_update" ON "Restaurant"
  FOR UPDATE USING (is_restaurant_owner(id));

-- المالك يحذف مطعمه فقط (مع التحقق من billingExempt)
CREATE POLICY "restaurant_owner_delete" ON "Restaurant"
  FOR DELETE USING (is_restaurant_owner(id) AND "billingExempt" = false);

-- =============================================================================
-- سياسات Setting (المالك فقط)
-- =============================================================================

CREATE POLICY "setting_owner_all" ON "Setting"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "Setting"."restaurantId"
        AND is_restaurant_owner(r.id)
    )
  );

-- =============================================================================
-- سياسات Category (المالك: كل شيء، العموم: قراءة المتاح فقط)
-- =============================================================================

-- المالك: صلاحيات كاملة
CREATE POLICY "category_owner_all" ON "Category"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "Category"."restaurantId"
        AND is_restaurant_owner(r.id)
    )
  );

-- العموم: قراءة الأصناف المتاحة فقط (لصفحة المنيو العامة)
CREATE POLICY "category_public_read" ON "Category"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "Category"."restaurantId"
        AND r.blocked = false
    )
  );

-- =============================================================================
-- سياسات MenuItem (المالك: كل شيء، العموم: قراءة المتاح فقط)
-- =============================================================================

CREATE POLICY "menu_item_owner_all" ON "MenuItem"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "MenuItem"."restaurantId"
        AND is_restaurant_owner(r.id)
    )
  );

CREATE POLICY "menu_item_public_read" ON "MenuItem"
  FOR SELECT USING (
    "isAvailable" = true
    AND EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "MenuItem"."restaurantId"
        AND r.blocked = false
    )
  );

-- =============================================================================
-- سياسات MenuItemSize (مرتبطة بـ MenuItem)
-- =============================================================================

CREATE POLICY "menu_item_size_owner_all" ON "MenuItemSize"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "MenuItem" mi
      JOIN "Restaurant" r ON r.id = mi."restaurantId"
      WHERE mi.id = "MenuItemSize"."menuItemId"
        AND is_restaurant_owner(r.id)
    )
  );

CREATE POLICY "menu_item_size_public_read" ON "MenuItemSize"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "MenuItem" mi
      JOIN "Restaurant" r ON r.id = mi."restaurantId"
      WHERE mi.id = "MenuItemSize"."menuItemId"
        AND mi."isAvailable" = true
        AND r.blocked = false
    )
  );

-- =============================================================================
-- سياسات Order (المالك: كل شيء، الموظف: قراءة/تحديث الحالة، العميل: إنشاء فقط)
-- =============================================================================

-- المالك: صلاحيات كاملة على طلبات مطعمه
CREATE POLICY "order_owner_all" ON "Order"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "Order"."restaurantId"
        AND is_restaurant_owner(r.id)
    )
  );

-- العموم: إنشاء طلب جديد (بدون مصادقة، عبر المنيو العام)
CREATE POLICY "order_public_insert" ON "Order"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "Order"."restaurantId"
        AND r.blocked = false
    )
  );

-- ملاحظة: قراءة/تحديث الطلبات للموظفين يتم عبر API route مع التحقق من staffPin
-- وليس عبر RLS مباشرة (لأن الموظفين ليسوا مستخدمين مصادق عليهم في Supabase)

-- =============================================================================
-- سياسات OrderItem (مرتبطة بـ Order)
-- =============================================================================

CREATE POLICY "order_item_owner_all" ON "OrderItem"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Order" o
      JOIN "Restaurant" r ON r.id = o."restaurantId"
      WHERE o.id = "OrderItem"."orderId"
        AND is_restaurant_owner(r.id)
    )
  );

CREATE POLICY "order_item_public_insert" ON "OrderItem"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Order" o
      JOIN "Restaurant" r ON r.id = o."restaurantId"
      WHERE o.id = "OrderItem"."orderId"
        AND r.blocked = false
    )
  );

-- =============================================================================
-- سياسات OrderWindow (نظام معدل الطلبات - خدمة فقط)
-- =============================================================================

-- لا وصول مباشر من العميل - يتم تحديثها عبر API routes مع service_role
CREATE POLICY "order_window_service_only" ON "OrderWindow"
  FOR ALL USING (false);

-- =============================================================================
-- سياسات DayStat (إحصائيات يومية - المالك قراءة، خدمة كتابة)
-- =============================================================================

CREATE POLICY "day_stat_owner_read" ON "DayStat"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "DayStat"."restaurantId"
        AND is_restaurant_owner(r.id)
    )
  );

CREATE POLICY "day_stat_service_write" ON "DayStat"
  FOR ALL USING (false);

-- =============================================================================
-- سياسات Staff (المالك فقط)
-- =============================================================================

CREATE POLICY "staff_owner_all" ON "Staff"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "Staff"."restaurantId"
        AND is_restaurant_owner(r.id)
    )
  );

-- =============================================================================
-- سياسات Table (المالك: كل شيء، العموم: قراءة أرقام الطاولات فقط)
-- =============================================================================

CREATE POLICY "table_owner_all" ON "Table"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "Table"."restaurantId"
        AND is_restaurant_owner(r.id)
    )
  );

CREATE POLICY "table_public_read" ON "Table"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "Table"."restaurantId"
        AND r.blocked = false
    )
  );

-- =============================================================================
-- سياسات Payment (المالك قراءة فقط، خدمة كتابة)
-- =============================================================================

CREATE POLICY "payment_owner_read" ON "Payment"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = "Payment"."restaurantId"
        AND is_restaurant_owner(r.id)
    )
  );

CREATE POLICY "payment_service_write" ON "Payment"
  FOR ALL USING (false);

-- =============================================================================
-- سياسات AuditLog (المالك قراءة فقط، خدمة كتابة)
-- =============================================================================

CREATE POLICY "audit_log_owner_read" ON "AuditLog"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "Restaurant" r
      WHERE r.id = (
        SELECT "restaurantId" FROM "Restaurant" WHERE id = "AuditLog"."targetName"::TEXT
        -- ملاحظة: targetName قد يحتوي على restaurantId أو معرف آخر
        -- تعديل حسب الاستخدام الفعلي
      )
      AND is_restaurant_owner(r.id)
    )
  );

-- بديل أبسط: المالك يرى سجلات مطعمه فقط
CREATE POLICY "audit_log_owner_read_v2" ON "AuditLog"
  FOR SELECT USING (
    "targetType" = 'restaurant' AND is_restaurant_owner("targetName"::TEXT)
  );

-- =============================================================================
-- سياسات OwnerLoginAttempt (خدمة فقط - للحماية من التخمين)
-- =============================================================================

CREATE POLICY "owner_login_attempt_service_only" ON "OwnerLoginAttempt"
  FOR ALL USING (false);

-- =============================================================================
-- سياسات SiteSetting (إعدادات المنصة - مشرف فقط)
-- =============================================================================

-- قراءة عامة للإعدادات العامة (مثل: feature flags)
CREATE POLICY "site_setting_public_read" ON "SiteSetting"
  FOR SELECT USING (true);

-- كتابة بواسطة service_role فقط (من لوحة المشرف العامة)
CREATE POLICY "site_setting_service_write" ON "SiteSetting"
  FOR ALL USING (false);

-- =============================================================================
-- منح الصلاحيات للأدوار (Grants)
-- =============================================================================

-- دور anon (غير مصادق) - للقراءة العامة للمنيو
GRANT SELECT ON "Category" TO anon;
GRANT SELECT ON "MenuItem" TO anon;
GRANT SELECT ON "MenuItemSize" TO anon;
GRANT SELECT ON "Table" TO anon;
GRANT INSERT ON "Order" TO anon;
GRANT INSERT ON "OrderItem" TO anon;

-- دور authenticated (مصادق - المالك) - صلاحيات كاملة على بياناته
GRANT ALL ON "Restaurant" TO authenticated;
GRANT ALL ON "Setting" TO authenticated;
GRANT ALL ON "Category" TO authenticated;
GRANT ALL ON "MenuItem" TO authenticated;
GRANT ALL ON "MenuItemSize" TO authenticated;
GRANT ALL ON "Order" TO authenticated;
GRANT ALL ON "OrderItem" TO authenticated;
GRANT ALL ON "DayStat" TO authenticated;
GRANT ALL ON "Staff" TO authenticated;
GRANT ALL ON "Table" TO authenticated;
GRANT ALL ON "Payment" TO authenticated;
GRANT SELECT ON "AuditLog" TO authenticated;

-- دور service_role (للخدمات الخلفية، webhooks، cron) - صلاحيات كاملة
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- =============================================================================
-- التحقق: عرض السياسات المطبقة
-- =============================================================================

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =============================================================================
-- ملاحظات مهمة:
-- =============================================================================
-- 1. السياسات أعلاه تفترض أن المالك مصادق عبر Supabase Auth (auth.uid() = ownerId)
-- 2. الموظفين يدخلون بـ staffPin مشترك - التحقق يتم في API routes وليس RLS
-- 3. OrderWindow و DayStat و Payment و AuditLog تُحدث عبر service_role
-- 4. راجع سياسة AuditLog وعدّلها حسب هيكل targetName الفعلي
-- 5. بعد التطبيب، اختبر: تسجيل دخول بمالك → عرض مطعمه فقط
--    تسجيل دخول بمالك آخر → لا يرى مطعم الأول
--    طلب غير مصادق → يستطيع قراءة المنيو وإنشاء طلب