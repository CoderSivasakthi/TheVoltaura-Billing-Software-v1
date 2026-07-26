import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT event_manipulation 
            FROM information_schema.triggers 
            WHERE trigger_name = 'trg_generate_quotation_id';
        `);
        console.log("Trigger events:", res.rows);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
