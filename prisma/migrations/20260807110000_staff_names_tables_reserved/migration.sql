-- Staff: restaurant employee (name only - login uses shared restaurant PIN)
CREATE TABLE "Staff" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Staff_restaurantId_idx" ON "Staff"("restaurantId");
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Table.reserved: table availability (available/reserved)
ALTER TABLE "Table" ADD COLUMN "reserved" BOOLEAN NOT NULL DEFAULT false;

-- Order.staffName: staff member who handled the order (admin panel only)
ALTER TABLE "Order" ADD COLUMN "staffName" TEXT;
