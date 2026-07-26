import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT event_object_table, trigger_name, action_statement
            FROM information_schema.triggers
            WHERE event_object_table = 'quotations';
        `);
        console.log("Triggers:", res.rows);
        client.release();
    } catch(e) { console.error(e); } finally { pool.end(); }
}
run();
