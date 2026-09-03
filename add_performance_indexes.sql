-- Performance indexes for QR Menu SaaS
-- Run this against your Supabase database (SQL Editor)

-- Index for Order queries (restaurantId, status, createdAt)
CREATE INDEX IF NOT EXISTS idx_order_restaurant_status_created 
ON "Order" ("restaurantId", "status", "createdAt" DESC);

-- Index for MenuItem queries (restaurantId, isAvailable)  
CREATE INDEX IF NOT EXISTS idx_menuitem_restaurant_available 
ON "MenuItem" ("restaurantId", "isAvailable");

-- Index for OrderItem queries (orderId, itemId)
CREATE INDEX IF NOT EXISTS idx_orderitem_order_item 
ON "OrderItem" ("orderId", "itemId");

-- Index for Category queries (restaurantId, sortOrder)
CREATE INDEX IF NOT EXISTS idx_category_restaurant_sort 
ON "Category" ("restaurantId", "sortOrder");

-- Index for Staff queries (restaurantId, name case-insensitive)
CREATE INDEX IF NOT EXISTS idx_staff_restaurant_name_ci 
ON "Staff" ("restaurantId", "name");

-- Index for Table queries (restaurantId, number)
CREATE INDEX IF NOT EXISTS idx_table_restaurant_number 
ON "Table" ("restaurantId", "number");

-- Index for DayStat queries (restaurantId, date)
CREATE INDEX IF NOT EXISTS idx_daystat_restaurant_date 
ON "DayStat" ("restaurantId", "date");

-- Index for Setting queries (restaurantId)
CREATE INDEX IF NOT EXISTS idx_setting_restaurant 
ON "Setting" ("restaurantId");

-- Composite index for best sellers query
CREATE INDEX IF NOT EXISTS idx_orderitem_order_created 
ON "OrderItem" ("orderId", "itemId") 
INCLUDE ("qty");

-- Verify indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;