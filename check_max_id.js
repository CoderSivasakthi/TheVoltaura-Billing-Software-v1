import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT id FROM customers ORDER BY id DESC LIMIT 5;
        `);
        console.log(res.rows);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
