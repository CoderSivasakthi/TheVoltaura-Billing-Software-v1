const { Client } = require('pg');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB || '';
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL environment variable (Supabase Postgres)');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

async function run() {
  await client.connect();
  const sql = fs.readFileSync(__dirname + '/supabase-schema.sql', 'utf8');
  console.log('Running migrations...');
  await client.query(sql);

  console.log('Seeding basic data...');
  // Insert minimal seed rows
  await client.query("INSERT INTO users (username, password, role) VALUES ('admin','', 'admin') ON CONFLICT DO NOTHING");
  await client.query("INSERT INTO customers (id,name,city) VALUES ('CUST-1','Demo Customer','Mumbai') ON CONFLICT DO NOTHING");
  await client.query("INSERT INTO products (id,name,price,stock) VALUES ('PROD-1','Solar Panel',50000,10) ON CONFLICT DO NOTHING");

  console.log('Done.');
  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
