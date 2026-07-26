import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        
        await client.query(`
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS "documents" JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE customers ADD COLUMN IF NOT EXISTS "customerInfo" JSONB DEFAULT '{}'::jsonb;
        `);
        console.log("Customer columns added.");
        
        await client.query(`NOTIFY pgrst, 'reload schema'`);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
