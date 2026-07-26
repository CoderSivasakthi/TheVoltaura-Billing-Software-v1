import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.oybaxcchjmdxmspsqydv:TVABILL%400603@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    try {
        const client = await pool.connect();
        console.log("Syncing invoice columns with quotation for conversion payload...");
        
        // These are the quotation specific columns that we just added to quotations
        // Since /api/quotations/:id/convert spreads the quotation object (...q), 
        // the invoices table MUST also accept them to avoid Supabase throwing errors.
        await client.query(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS "companyBranchId" TEXT,
            ADD COLUMN IF NOT EXISTS "companyGst" TEXT,
            ADD COLUMN IF NOT EXISTS "companyAddress" TEXT,
            ADD COLUMN IF NOT EXISTS "billingAddr" TEXT,
            ADD COLUMN IF NOT EXISTS "siteAddr" TEXT,
            ADD COLUMN IF NOT EXISTS "notes" TEXT,
            ADD COLUMN IF NOT EXISTS "customerInfo" JSONB,
            ADD COLUMN IF NOT EXISTS "engineMetrics" JSONB,
            ADD COLUMN IF NOT EXISTS "projectType" TEXT,
            ADD COLUMN IF NOT EXISTS "customerCategory" TEXT,
            ADD COLUMN IF NOT EXISTS "applyMnreSubsidy" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "applySplitGst" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "documents" JSONB,
            ADD COLUMN IF NOT EXISTS "systemSizeKw" NUMERIC,
            ADD COLUMN IF NOT EXISTS "dailyGeneration" NUMERIC,
            ADD COLUMN IF NOT EXISTS "annualGeneration" NUMERIC,
            ADD COLUMN IF NOT EXISTS "gstAmount" NUMERIC,
            ADD COLUMN IF NOT EXISTS "subsidyAmount" NUMERIC,
            ADD COLUMN IF NOT EXISTS "netCustomerCost" NUMERIC,
            ADD COLUMN IF NOT EXISTS "validUntil" TEXT,
            
            -- Explicit properties added in convert endpoint
            ADD COLUMN IF NOT EXISTS "sourceQuotationId" TEXT;
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
