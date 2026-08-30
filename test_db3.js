require('dotenv').config();
const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB });
  await client.connect();
  const res = await client.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'users';
  `);
  console.log('Triggers for users:', res.rows);
  await client.end();
}
run();
