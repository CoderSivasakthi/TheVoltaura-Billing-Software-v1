import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const client = await pool.connect();
        
        await client.query(`
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "title" TEXT;
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "type" TEXT;
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "link" TEXT;
        `);
        console.log("notifications table successfully updated with all columns.");
        
        await client.query(`NOTIFY pgrst, 'reload schema'`);
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
