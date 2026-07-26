require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: set } = await sb.from('settings').select('*').eq('id', 'global').single();
  let gs = set.global_settings;
  
  gs.quotationCounter = 202627007;
  gs.invoiceCounter = 202627017;
  
  await sb.from('settings').update({ global_settings: gs }).eq('id', 'global');
  console.log("Counters updated successfully!");
}
run();
