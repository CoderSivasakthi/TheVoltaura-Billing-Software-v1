import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`SELECT global_settings FROM company_settings WHERE id = 'global';`);
        console.log("Global Settings:", JSON.stringify(res.rows[0].global_settings, null, 2));
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
