require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await supabase.from('orders').select('*').limit(1);
  if (error) console.error("Error from orders:", error.message);
  else console.log("Orders table exists and has", data.length, "rows.");
}
check();
