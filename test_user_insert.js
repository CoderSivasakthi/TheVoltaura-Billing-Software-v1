const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);
async function test() {
  const { data, error } = await supabase.from('users').insert([{
    username: 'test_insert',
    password: 'abc',
    role: 'franchise_admin',
    tenant_id: 'test',
    franchise_id: null,
    is_active: true
  }]);
  console.log(error);
}
test();
