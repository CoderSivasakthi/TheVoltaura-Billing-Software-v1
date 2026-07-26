import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.oybaxcchjmdxmspsqydv:TVABILL%400603@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quotations';
        `);
        console.log(res.rows.map(r => r.column_name));
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
