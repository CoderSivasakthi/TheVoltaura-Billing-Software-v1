const pg = require('pg');
require('dotenv').config();
async function test() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'customer_documents';
    `);
    console.log(rows);
    pool.end();
}
test();
