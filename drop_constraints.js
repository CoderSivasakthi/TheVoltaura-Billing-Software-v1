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
            ALTER TABLE quotations DROP CONSTRAINT IF EXISTS chk_quotation_status;
            ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoice_status;
            ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_order_status;
            ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_order_priority;
        `);
        console.log("Status constraints successfully dropped.");
        
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
