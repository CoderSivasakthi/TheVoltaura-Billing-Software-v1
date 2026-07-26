const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function run() {
  const { data: inv } = await sb.from('invoices').select('*').eq('id', 'INV/TVA/202627016').single();
  console.log("INVOICE:", JSON.stringify(inv, null, 2));
  
  if (inv.quotation_id || inv.quotationId) {
    const qid = inv.quotation_id || inv.quotationId;
    const { data: q } = await sb.from('quotations').select('*').eq('id', qid).single();
    console.log("QUOTATION:", JSON.stringify(q, null, 2));
  }
}
run();
