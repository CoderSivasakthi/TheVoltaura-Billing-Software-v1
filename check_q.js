import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`SELECT id FROM quotations WHERE id = 'QTVA2026270003';`);
        console.log("Found:", res.rows);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
