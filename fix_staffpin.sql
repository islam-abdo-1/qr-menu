-- Migration: fix_staffpin_required
-- Remove default from staffPin, add unique constraint, update existing empty pins

-- Step 1: Update existing restaurants with empty staffPin to have unique pins
UPDATE "Restaurant" 
SET "staffPin" = LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0')
WHERE "staffPin" = '' OR "staffPin" IS NULL;

-- Step 2: Remove default value
ALTER TABLE "Restaurant" ALTER COLUMN "staffPin" DROP DEFAULT;

-- Step 3: Add unique constraint (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Restaurant_staffPin_key' AND conrelid = '"Restaurant"'::regclass
    ) THEN
        ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_staffPin_key" UNIQUE ("staffPin");
    END IF;
END $$;

-- Step 4: Ensure column is not null (already not null in DB)
-- ALTER TABLE "Restaurant" ALTER COLUMN "staffPin" SET NOT NULL;