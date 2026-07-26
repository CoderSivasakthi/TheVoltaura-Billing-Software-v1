require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function check() {
  const { data, error } = await supabase.rpc('get_column_types', { table_name: 'invoices' });
  console.log(data, error);
}
check();
