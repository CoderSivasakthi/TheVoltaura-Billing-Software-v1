const pg = require('pg');
require('dotenv').config();
async function run() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
        ALTER TABLE customer_documents 
        ADD COLUMN IF NOT EXISTS quotation_id text,
        ADD COLUMN IF NOT EXISTS bucket_name text DEFAULT 'erp-documents';
    `);
    console.log("Database altered successfully.");
    pool.end();
}
run();
