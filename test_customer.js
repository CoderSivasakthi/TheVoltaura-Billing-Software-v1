const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);
async function test() {
  const { data, error } = await supabase.from('customers').insert([{
    name: 'Test Customer',
    email: 'test@example.com',
    tenant_id: 'test_tenant',
    franchise_id: 'TVA-FR-0003'
  }]);
  console.log(error);
}
test();
