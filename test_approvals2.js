const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const [quotations, invoices] = await Promise.all([
      supa.from('quotations')
        .select('id, franchise_id, customer_name, system_size_kw, grand_total, submitted_at, approval_status')
        .eq('approval_status', 'Submitted')
        .order('submitted_at', { ascending: true }),
      supa.from('invoices')
        .select('id, franchise_id, customer_name, grand_total, submitted_at, approval_status')
        .eq('approval_status', 'Submitted')
        .order('submitted_at', { ascending: true }),
    ]);
    console.log("Quotations data:", quotations.data?.length, "Error:", quotations.error);
    console.log("Invoices data:", invoices.data?.length, "Error:", invoices.error);
}
run();
