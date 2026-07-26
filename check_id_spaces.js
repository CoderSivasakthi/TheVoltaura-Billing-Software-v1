import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`SELECT id, length(id) as len FROM quotations;`);
        console.log("IDs:", res.rows);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
