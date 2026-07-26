import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.oybaxcchjmdxmspsqydv:TVABILL%400603@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    try {
        const client = await pool.connect();
        
        await client.query(`
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "modelNumber" TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "productStatus" TEXT DEFAULT 'Active';
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "netPrice" NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "sellingPrice" NUMERIC DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'Nos';
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "technicalSpecification" TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "reorderLevel" INTEGER DEFAULT 0;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "warehouse" TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "storageLocation" TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "supplier" TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "productImageUrl" TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "datasheetUrl" TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "warrantyUrl" TEXT;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "productType" TEXT DEFAULT 'Stock Item';
        `);
        console.log("products table successfully updated with new columns.");
        
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
