const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('invoices').select('*').limit(1);
  if(data) console.log(Object.keys(data[0]));
  else console.log(error);
}
run();
