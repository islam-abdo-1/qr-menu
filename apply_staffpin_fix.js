const {Client} = require("pg");
const c = new Client({connectionString: "postgresql://postgres:QR_MENU_2303AN@db.chczpvevpfqiyvfwjbro.supabase.co:5432/postgres?connection_limit=2"});

const sql = `
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
`;

c.connect().then(() => c.query(sql))
  .then(r => { console.log("Migration applied successfully"); return c.end(); })
  .catch(e => console.error(e.message));