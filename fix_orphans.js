const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);

async function run() {
  await supabase.from('franchises').delete().in('id', ['TVA-FR-0001', 'TVA-FR-0002']);
  await supabase.from('tenant_settings').delete().in('tenant_id', ['TVA-FR-0001', 'TVA-FR-0002']);
  console.log("Orphaned franchises deleted.");
}
run();
