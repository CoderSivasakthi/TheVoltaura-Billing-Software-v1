import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const client = await pool.connect();
        await client.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_product_category;`);
        console.log("Constraint dropped.");
        await client.query(`NOTIFY pgrst, 'reload schema'`);
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
