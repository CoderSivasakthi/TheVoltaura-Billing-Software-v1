require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
async function check() {
  const qPayload = {
      id: "TEST-Q-3",
      company_branch_id: "1"
    };
  
  const { error } = await supabase.from('quotations').insert([qPayload]);
  console.log("Insert Error Q 3:", error);
}
check();
