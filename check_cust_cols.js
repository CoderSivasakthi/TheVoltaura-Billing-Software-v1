import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'customers';
        `);
        console.log("Customers cols:", res.rows.map(r => r.column_name));
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
