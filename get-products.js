require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function run() {
  const { data: p } = await sb.from('products').select('*');
  console.log(p.map(x => x.name));
}
run();
