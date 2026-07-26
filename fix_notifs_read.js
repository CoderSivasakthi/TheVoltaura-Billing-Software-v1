import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const client = await pool.connect();
        
        // Add read column
        await client.query(`
            ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "read" BOOLEAN DEFAULT false;
        `);
        console.log("notifications table successfully updated with read.");
        
        await client.query(`NOTIFY pgrst, 'reload schema'`);
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
