require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const url = process.env.SUPABASE_DB_URL;
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  const sql = fs.readFileSync('scripts/master_schema_v3.sql', 'utf8');
  try {
    await client.query(sql);
    console.log('SUCCESS');
  } catch (e) {
    console.log('ERROR:', e.message);
  }
  await client.end();
}
run();
