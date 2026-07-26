import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.oybaxcchjmdxmspsqydv:TVABILL%400603@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    try {
        const client = await pool.connect();
        
        console.log("Adding columns to quotations...");
        await client.query(`
            ALTER TABLE quotations 
            ADD COLUMN IF NOT EXISTS "companyBranchId" TEXT,
            ADD COLUMN IF NOT EXISTS "companyGst" TEXT,
            ADD COLUMN IF NOT EXISTS "companyAddress" TEXT,
            ADD COLUMN IF NOT EXISTS "customerId" TEXT,
            ADD COLUMN IF NOT EXISTS "customerName" TEXT,
            ADD COLUMN IF NOT EXISTS "date" TEXT,
            ADD COLUMN IF NOT EXISTS "validUntil" TEXT,
            ADD COLUMN IF NOT EXISTS "billingAddr" TEXT,
            ADD COLUMN IF NOT EXISTS "siteAddr" TEXT,
            ADD COLUMN IF NOT EXISTS "notes" TEXT,
            ADD COLUMN IF NOT EXISTS "discount" NUMERIC,
            ADD COLUMN IF NOT EXISTS "status" TEXT,
            ADD COLUMN IF NOT EXISTS "items" JSONB,
            ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC,
            ADD COLUMN IF NOT EXISTS "totalTax" NUMERIC,
            ADD COLUMN IF NOT EXISTS "grandTotal" NUMERIC,
            ADD COLUMN IF NOT EXISTS "total" NUMERIC,
            ADD COLUMN IF NOT EXISTS "customerInfo" JSONB,
            ADD COLUMN IF NOT EXISTS "engineMetrics" JSONB,
            ADD COLUMN IF NOT EXISTS "supplyType" TEXT,
            ADD COLUMN IF NOT EXISTS "projectType" TEXT,
            ADD COLUMN IF NOT EXISTS "customerCategory" TEXT,
            ADD COLUMN IF NOT EXISTS "applyMnreSubsidy" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "applySplitGst" BOOLEAN,
            ADD COLUMN IF NOT EXISTS "createdAt" TEXT;
        `);
        console.log("Quotations columns added.");

        console.log("Adding columns to invoices...");
        await client.query(`
            ALTER TABLE invoices 
            ADD COLUMN IF NOT EXISTS "customerId" TEXT,
            ADD COLUMN IF NOT EXISTS "customerName" TEXT,
            ADD COLUMN IF NOT EXISTS "date" TEXT,
            ADD COLUMN IF NOT EXISTS "dueDate" TEXT,
            ADD COLUMN IF NOT EXISTS "supplyType" TEXT,
            ADD COLUMN IF NOT EXISTS "appRegNo" TEXT,
            ADD COLUMN IF NOT EXISTS "appSanctionNo" TEXT,
            ADD COLUMN IF NOT EXISTS "tangedcoNo" TEXT,
            ADD COLUMN IF NOT EXISTS "dispatchedThrough" TEXT,
            ADD COLUMN IF NOT EXISTS "lrRrNo" TEXT,
            ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC,
            ADD COLUMN IF NOT EXISTS "totalTax" NUMERIC,
            ADD COLUMN IF NOT EXISTS "gst" NUMERIC,
            ADD COLUMN IF NOT EXISTS "discount" NUMERIC,
            ADD COLUMN IF NOT EXISTS "grandTotal" NUMERIC,
            ADD COLUMN IF NOT EXISTS "total" NUMERIC,
            ADD COLUMN IF NOT EXISTS "createdAt" TEXT,
            ADD COLUMN IF NOT EXISTS "quotationId" TEXT,
            ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
        `);
        console.log("Invoices columns added.");

        console.log("Adding columns to orders...");
        await client.query(`
            ALTER TABLE orders 
            ADD COLUMN IF NOT EXISTS "orderId" TEXT,
            ADD COLUMN IF NOT EXISTS "quotationId" TEXT,
            ADD COLUMN IF NOT EXISTS "customerId" TEXT,
            ADD COLUMN IF NOT EXISTS "customerName" TEXT,
            ADD COLUMN IF NOT EXISTS "amount" NUMERIC,
            ADD COLUMN IF NOT EXISTS "type" TEXT,
            ADD COLUMN IF NOT EXISTS "status" TEXT,
            ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT,
            ADD COLUMN IF NOT EXISTS "reference" TEXT,
            ADD COLUMN IF NOT EXISTS "date" TEXT,
            ADD COLUMN IF NOT EXISTS "notes" TEXT,
            ADD COLUMN IF NOT EXISTS "createdAt" TEXT;
        `);
        console.log("Orders columns added.");

        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
