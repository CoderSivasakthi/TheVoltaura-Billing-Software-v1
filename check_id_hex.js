import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`SELECT id, encode(id::bytea, 'hex') as hex FROM quotations WHERE id LIKE '%003%';`);
        console.log("Hex:", res.rows);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
