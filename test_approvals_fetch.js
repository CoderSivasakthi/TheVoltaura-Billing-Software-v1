const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  // Set one quotation to Submitted
  await supabase.from('quotations').update({ approval_status: 'Submitted', submitted_at: new Date().toISOString() }).eq('id', 'QTVA2026270005');

  // Now run the exact query
  const res = await supabase.from('quotations')
      .select('id, franchise_id, customer_name, customerName, system_size_kw, systemSizeKw, grand_total, grandTotal, submitted_at, approval_status')
      .eq('approval_status', 'Submitted')
      .order('submitted_at', { ascending: true });

  console.log('Result:', res);

  // Set back to Draft
  await supabase.from('quotations').update({ approval_status: 'Draft' }).eq('id', 'QTVA2026270005');
}
run();
