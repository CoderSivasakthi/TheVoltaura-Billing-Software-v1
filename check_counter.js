import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const setRes = await client.query(`SELECT quotations_counter FROM settings WHERE id = 'global';`);
        console.log("Counter:", setRes.rows[0].quotations_counter);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
