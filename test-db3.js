const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY, { auth: { persistSession: false } });

async function test() {
  const { data, error } = await supabase.from('invoice_items').select('*').limit(1);
  console.log(error ? error.message : 'Exists!');
}
test();
