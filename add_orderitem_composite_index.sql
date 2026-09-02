-- Migration: add_orderitem_composite_index
-- Add composite index on OrderItem (itemId, orderId) for best sellers query

CREATE INDEX IF NOT EXISTS "OrderItem_itemId_orderId_idx" ON "OrderItem" ("itemId", "orderId");