const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);
async function test() {
  const { data, error } = await supabase.rpc('generate_customer_code');
  console.log('RPC Error:', error);
  console.log('Data:', data);
}
test();
