require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  const { data: q } = await sb.from('quotations').select('id');
  console.log("Quotations IDs:", q.map(x => x.id).sort());
  
  const { data: i } = await sb.from('invoices').select('id');
  console.log("Invoice IDs:", i.map(x => x.id).sort());
}
run();
