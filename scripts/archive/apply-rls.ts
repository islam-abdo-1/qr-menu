import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DIRECT_URL, max: 1, connectionTimeoutMillis: 10000 });

const sql = `
-- =============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES - CORRECTED
-- =============================================================================
-- All camelCase columns quoted with double quotes

-- 1. Enable RLS on all tables
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
-- Helper Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_current_restaurant_id()
RETURNS TEXT AS $$
DECLARE
  v_user_id TEXT;
  v_restaurant_id TEXT;
BEGIN
  v_user_id := auth.uid()::TEXT;
  IF v_user_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_restaurant_id FROM "Restaurant" WHERE "ownerId" = v_user_id LIMIT 1;
  RETURN v_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_restaurant_owner(p_restaurant_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_current_restaurant_id() = p_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Policies
-- =============================================================================

-- Restaurant (owner only)
CREATE POLICY "restaurant_owner_select" ON "Restaurant" FOR SELECT USING (is_restaurant_owner(id));
CREATE POLICY "restaurant_owner_update" ON "Restaurant" FOR UPDATE USING (is_restaurant_owner(id));
CREATE POLICY "restaurant_owner_delete" ON "Restaurant" FOR DELETE USING (is_restaurant_owner(id) AND "billingExempt" = false);

-- Setting (owner only)
CREATE POLICY "setting_owner_all" ON "Setting" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "Setting"."restaurantId" AND is_restaurant_owner(r.id))
);

-- Category (owner: all, public: read non-blocked)
CREATE POLICY "category_owner_all" ON "Category" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "Category"."restaurantId" AND is_restaurant_owner(r.id))
);
CREATE POLICY "category_public_read" ON "Category" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "Category"."restaurantId" AND r.blocked = false)
);

-- MenuItem (owner: all, public: read available + non-blocked)
CREATE POLICY "menu_item_owner_all" ON "MenuItem" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "MenuItem"."restaurantId" AND is_restaurant_owner(r.id))
);
CREATE POLICY "menu_item_public_read" ON "MenuItem" FOR SELECT USING (
  "isAvailable" = true AND EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "MenuItem"."restaurantId" AND r.blocked = false)
);

-- MenuItemSize (via MenuItem)
CREATE POLICY "menu_item_size_owner_all" ON "MenuItemSize" FOR ALL USING (
  EXISTS (SELECT 1 FROM "MenuItem" mi JOIN "Restaurant" r ON r.id = mi."restaurantId" WHERE mi.id = "MenuItemSize"."menuItemId" AND is_restaurant_owner(r.id))
);
CREATE POLICY "menu_item_size_public_read" ON "MenuItemSize" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "MenuItem" mi JOIN "Restaurant" r ON r.id = mi."restaurantId" WHERE mi.id = "MenuItemSize"."menuItemId" AND mi."isAvailable" = true AND r.blocked = false)
);

-- Order (owner: all, public: insert only)
CREATE POLICY "order_owner_all" ON "Order" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "Order"."restaurantId" AND is_restaurant_owner(r.id))
);
CREATE POLICY "order_public_insert" ON "Order" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "Order"."restaurantId" AND r.blocked = false)
);

-- OrderItem (via Order)
CREATE POLICY "order_item_owner_all" ON "OrderItem" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Order" o JOIN "Restaurant" r ON r.id = o."restaurantId" WHERE o.id = "OrderItem"."orderId" AND is_restaurant_owner(r.id))
);
CREATE POLICY "order_item_public_insert" ON "OrderItem" FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM "Order" o JOIN "Restaurant" r ON r.id = o."restaurantId" WHERE o.id = "OrderItem"."orderId" AND r.blocked = false)
);

-- OrderWindow (service only)
CREATE POLICY "order_window_service_only" ON "OrderWindow" FOR ALL USING (false);

-- DayStat (owner read, service write)
CREATE POLICY "day_stat_owner_read" ON "DayStat" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "DayStat"."restaurantId" AND is_restaurant_owner(r.id))
);
CREATE POLICY "day_stat_service_write" ON "DayStat" FOR ALL USING (false);

-- Staff (owner only)
CREATE POLICY "staff_owner_all" ON "Staff" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "Staff"."restaurantId" AND is_restaurant_owner(r.id))
);

-- Table (owner: all, public: read non-blocked)
CREATE POLICY "table_owner_all" ON "Table" FOR ALL USING (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "Table"."restaurantId" AND is_restaurant_owner(r.id))
);
CREATE POLICY "table_public_read" ON "Table" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "Table"."restaurantId" AND r.blocked = false)
);

-- Payment (owner read, service write)
CREATE POLICY "payment_owner_read" ON "Payment" FOR SELECT USING (
  EXISTS (SELECT 1 FROM "Restaurant" r WHERE r.id = "Payment"."restaurantId" AND is_restaurant_owner(r.id))
);
CREATE POLICY "payment_service_write" ON "Payment" FOR ALL USING (false);

-- AuditLog (owner read via targetName when targetType='restaurant')
CREATE POLICY "audit_log_owner_read" ON "AuditLog" FOR SELECT USING (
  "targetType" = 'restaurant' AND is_restaurant_owner("targetName"::TEXT)
);

-- OwnerLoginAttempt (service only)
CREATE POLICY "owner_login_attempt_service_only" ON "OwnerLoginAttempt" FOR ALL USING (false);

-- SiteSetting (public read, service write)
CREATE POLICY "site_setting_public_read" ON "SiteSetting" FOR SELECT USING (true);
CREATE POLICY "site_setting_service_write" ON "SiteSetting" FOR ALL USING (false);

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT ON "Category" TO anon;
GRANT SELECT ON "MenuItem" TO anon;
GRANT SELECT ON "MenuItemSize" TO anon;
GRANT SELECT ON "Table" TO anon;
GRANT INSERT ON "Order" TO anon;
GRANT INSERT ON "OrderItem" TO anon;

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

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- =============================================================================
-- Verification
-- =============================================================================
SELECT schemaname, tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('Applying RLS policies...');
    await client.query(sql);
    console.log('✅ RLS policies applied successfully');
    
    // Verify
    const res = await client.query(`
      SELECT schemaname, tablename, policyname, cmd 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      ORDER BY tablename, policyname
    `);
    console.log('\nApplied policies:');
    res.rows.forEach(r => console.log(`  ${r.tablename}: ${r.policyname} (${r.cmd})`));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('❌ Error:', msg);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
run();