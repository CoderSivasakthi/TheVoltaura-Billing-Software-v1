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
            ALTER TABLE products ADD COLUMN IF NOT EXISTS "minStock" INTEGER DEFAULT 0;
        `);
        console.log("products table successfully updated with minStock.");
        
        // Supabase needs to reload schema cache
        await client.query(`NOTIFY pgrst, 'reload schema'`);
        
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
