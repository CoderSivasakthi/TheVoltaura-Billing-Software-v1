require('dotenv').config();
const { Client } = require('pg');
const regions = ['us-east-1', 'eu-central-1', 'ap-southeast-1', 'ap-south-1', 'us-west-1', 'eu-west-1', 'eu-west-2', 'sa-east-1', 'ap-northeast-1'];

async function test() {
  for (const r of regions) {
    const url = process.env.SUPABASE_DB_URL; // Replaced hardcoded connection string with environment variable
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log('SUCCESS REGION:', r);
      await client.end();
      process.exit(0);
    } catch (e) {
      if (!e.message.includes('ENOTFOUND')) {
        console.log('INTERESTING ERROR FOR', r, e.message);
      }
    }
  }
  console.log('NOT FOUND');
}
test();
