import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query("SELECT * FROM settings WHERE id = 'global'");
        console.log("Settings global:", res.rows[0]);
        client.release();
    } catch(e) { console.error("Error:", e); } finally { pool.end(); }
}
run();
