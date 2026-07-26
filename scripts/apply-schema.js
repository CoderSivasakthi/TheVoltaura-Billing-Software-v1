/**
 * Execute the DDL schema against Supabase using the pg driver.
 * Requires DATABASE_URL to be set in .env
 * 
 * Usage: node scripts/apply-schema.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('\n❌ Error: DATABASE_URL is required to execute schema DDL.');
  console.error('Please add DATABASE_URL=postgres://postgres.YOUR_PROJECT_ID:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres to your .env file.');
  console.error('You can find this in Supabase Dashboard → Settings → Database → Connection string (URI).\n');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function runSchema() {
  console.log('===================================');
  console.log('SUPABASE SCHEMA EXECUTION');
  console.log('===================================');
  console.log('Connecting to database...');
  
  const client = await pool.connect();
  
  try {
    console.log('SUCCESS\n');
    
    const schemaPath = path.join(__dirname, 'master_schema_v3.sql');
    console.log(`Reading schema file: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    
    console.log('\nExecuting schema...');
    await client.query(schemaSql);
    console.log('SUCCESS');

    console.log('\nVerifying tables...');
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' 
      ORDER BY table_name;
    `);
    
    console.log(`\nFound ${result.rows.length} tables in public schema:`);
    result.rows.forEach(r => console.log(`  - ${r.table_name}`));
    
    console.log('\n===================================');
    console.log('DATABASE READY');
    console.log('===================================');
    
  } catch (err) {
    console.error('\nFAILED');
    console.error(`Reason:\n${err.message}`);
    if (err.position) {
        console.error(`Position: ${err.position}`);
    }
  } finally {
    client.release();
    pool.end();
  }
}

runSchema();
