import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        await client.query(`
            UPDATE settings 
            SET global_settings = jsonb_set(global_settings, '{invoiceCounter}', '4')
            WHERE id = 'global';
        `);
        console.log("Counter updated for invoice.");
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
