import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.oybaxcchjmdxmspsqydv:TVABILL%400603@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    try {
        const client = await pool.connect();
        console.log("Fixing all remaining camelCase schemas...");
        await client.query(`
            -- Customers
            ALTER TABLE customers DROP COLUMN IF EXISTS name CASCADE;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS "name" TEXT;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS "customerType" TEXT;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS "gstin" TEXT;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS "gstStatus" TEXT;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS "pan" TEXT;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS "aadhaar" TEXT;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS "shippingAddress" TEXT;

            -- Products
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "brand" TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "gstRate" NUMERIC;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "hsnCode" TEXT;

            -- AMC
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "vendorName" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "vendorContact" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "companyName" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "vendorEmail" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "vendorAddress" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "contractStartDate" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "amcStartDate" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "contractEndDate" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "amcExpiryDate" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "agreementDate" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "amcContractValue" NUMERIC;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "gst" NUMERIC;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "equipment" JSONB;
            ALTER TABLE amc ADD COLUMN IF NOT EXISTS "totalContractValue" NUMERIC;
        `);
        console.log("All columns successfully synced.");
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
