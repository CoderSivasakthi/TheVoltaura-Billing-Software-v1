const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const res = await supa.from('quotations').select('*').limit(1);
    console.log(Object.keys(res.data[0]));
}
run();
