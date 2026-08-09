const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
    const res = await supa.from('orders').select('*').limit(1);
    console.log("Orders columns:", res.data ? Object.keys(res.data[0]) : res.error);
}
run();
