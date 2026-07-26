import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const client = await pool.connect();
        
        // Fix notifications createdAt column
        await client.query(`
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        `);
        console.log("notifications table successfully updated with createdAt.");
        
        // Let's check max ID in quotations to see what's happening
        const res = await client.query(`SELECT id FROM quotations ORDER BY id DESC LIMIT 5;`);
        console.log("Latest Quotation IDs:", res.rows);
        
        await client.query(`NOTIFY pgrst, 'reload schema'`);
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
