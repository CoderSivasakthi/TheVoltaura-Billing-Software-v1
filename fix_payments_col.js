import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        
        await client.query(`
            ALTER TABLE quotations ADD COLUMN IF NOT EXISTS "payments" JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "payments" JSONB DEFAULT '[]'::jsonb;
        `);
        console.log("payments columns added.");
        
        await client.query(`NOTIFY pgrst, 'reload schema'`);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
