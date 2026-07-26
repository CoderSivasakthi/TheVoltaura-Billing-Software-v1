require('dotenv').config();
const { Client } = require('pg');
const url = process.env.SUPABASE_DB_URL;
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
client.connect()
  .then(() => { console.log('CONNECTED TO POOLER!'); client.end(); })
  .catch(e => console.log('ERROR:', e.message));
