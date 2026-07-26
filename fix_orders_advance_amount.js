import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        
        await client.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advanceAmount" numeric DEFAULT 0;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS "advancePaymentDate" text;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS "projectSize" text;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS "projectType" text;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS "grandTotal" numeric;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS "quotationNumber" text;
        `);
        console.log("Missing columns added to orders table.");
        
        await client.query(`NOTIFY pgrst, 'reload schema'`);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
