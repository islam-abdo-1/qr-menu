-- Add FK indexes for hot query paths
CREATE INDEX "Category_restaurantId_idx" ON "Category"("restaurantId");
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");
CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt" DESC);
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
