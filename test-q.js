require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function check() {
  const { data: q } = await supabase.from('quotations').select('*').eq('id', 'QTVA2026270005').single();
  console.log("Q:", q);
}
check();
