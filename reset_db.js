const fs = require('fs');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const tablesToClear = ['customers', 'quotations', 'invoices', 'payments', 'orders', 'products', 'notifications', 'ledger_entries', 'journal_entries', 'audit_logs', 'approval_logs', 'amc'];

async function run() {
  console.log('Starting Database Reset...');
  
  // 1. Supabase Backup & Wipe
  for (const t of tablesToClear) {
    console.log(`Processing Supabase table: ${t}`);
    
    // Backup
    const { data, error: errGet } = await supa.from(t).select('*');
    if (errGet) {
      console.log(`Error backing up ${t}:`, errGet.message);
    } else {
      fs.writeFileSync(`./db_backup_pre_reset/supabase_${t}.json`, JSON.stringify(data, null, 2));
      console.log(`- Backed up ${data.length} rows to supabase_${t}.json`);
    }
    
    // Wipe - Delete everything (if it has an ID, most of them do)
    // For safety, delete using .not('id', 'is', null). Or just .neq('id', '0000000000')
    const { data: delData, error: errDel } = await supa.from(t).delete().not('id', 'is', null).select();
    if (errDel) {
      console.log(`Error deleting ${t} via ID:`, errDel.message);
      // fallback for tables without id or UUID mismatch
      const { error: errDel2 } = await supa.from(t).delete().neq('created_at', '1970-01-01T00:00:00Z');
      if (errDel2) console.log(`Fallback error deleting ${t}:`, errDel2.message);
      else console.log(`- Wiped ${t} (fallback)`);
    } else {
       console.log(`- Wiped ${delData?.length || 0} rows from ${t}`);
    }
  }

  // 2. Local JSON files wipe
  console.log('\nWiping Local JSON Data...');
  for (const t of tablesToClear) {
    const filePath = `./data/${t}.json`;
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]');
      console.log(`- Cleared ${filePath}`);
    } else {
      console.log(`- ${filePath} does not exist. Created empty.`);
      fs.writeFileSync(filePath, '[]');
    }
  }

  console.log('\nDatabase Reset Complete!');
}

run();
