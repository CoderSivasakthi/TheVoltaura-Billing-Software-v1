import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.oybaxcchjmdxmspsqydv:TVABILL%400603@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    try {
        const client = await pool.connect();
        console.log("Adding missed columns to quotations...");
        await client.query(`
            ALTER TABLE quotations 
            ADD COLUMN IF NOT EXISTS "documents" JSONB,
            ADD COLUMN IF NOT EXISTS "systemSizeKw" NUMERIC,
            ADD COLUMN IF NOT EXISTS "dailyGeneration" NUMERIC,
            ADD COLUMN IF NOT EXISTS "annualGeneration" NUMERIC,
            ADD COLUMN IF NOT EXISTS "gstAmount" NUMERIC,
            ADD COLUMN IF NOT EXISTS "subsidyAmount" NUMERIC,
            ADD COLUMN IF NOT EXISTS "netCustomerCost" NUMERIC;
        `);
        console.log("Columns added.");
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
