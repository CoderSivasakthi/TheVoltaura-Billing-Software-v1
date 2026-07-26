require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function run() {
    const { data, error } = await supabase
        .from('quotations')
        .update({ status: 'Documents Pending' })
        .eq('id', 'QTVA2026270003')
        .select();
    console.log("Error:", error);
    console.log("Data:", data);
}
run();
