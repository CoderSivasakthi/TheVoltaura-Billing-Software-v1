import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT column_name, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'customers' AND column_name = 'id';
        `);
        console.log(res.rows);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
