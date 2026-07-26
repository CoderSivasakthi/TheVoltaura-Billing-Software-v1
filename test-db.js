require('dotenv').config();
const { Client } = require('pg');
const url = process.env.SUPABASE_DB_URL;
const client = new Client({ connectionString: url });
client.connect()
  .then(() => { console.log('CONNECTED'); client.end(); })
  .catch(e => console.log('ERROR:', e.message));
