const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
    const res = await supa.from('quotations').select('id, customer_name, customerName, grand_total, grandTotal, system_size_kw, systemSizeKw').eq('id', 'QT/TVA/202627011');
    console.log(res.data);
}
run();
