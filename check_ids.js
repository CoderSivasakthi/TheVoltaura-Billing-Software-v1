import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`SELECT id FROM quotations ORDER BY id DESC;`);
        console.log("Quotations:", res.rows);
        const setRes = await client.query(`SELECT "quotationCounter" FROM settings WHERE id = 'global';`);
        console.log("Counter:", setRes.rows[0].quotationCounter);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
