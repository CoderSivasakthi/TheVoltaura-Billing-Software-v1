require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: users, error } = await supa.from('users').select('*');
  console.log('Users:', users, error);
}
run();
