require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function check() {
  const { data, error } = await supabase.from('invoices').select('*').limit(0);
  console.log("Error:", error);
}
check();
