/**
 * Execute DDL + Seed SQL against Supabase using the service_role key
 * via the Supabase SQL execution API endpoint.
 *
 * Run: node scripts/setup-supabase.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function executeSQL(sql, label) {
    // Try multiple Supabase SQL execution endpoints
    const endpoints = [
        '/rest/v1/rpc',     // RPC endpoint
        '/pg/query',        // Direct SQL endpoint (newer)
    ];

    // Method 1: Use the service_role key with the REST API to check schema
    console.log(`\n📋 ${label}...`);

    // Actually, for DDL we need to use a custom approach.
    // The Supabase @supabase/supabase-js client with service_role can call rpc functions.
    // But to run raw DDL, we need either:
    // 1. The /pg endpoint (if available)
    // 2. Create a temporary function via PostgREST and then call it
    // Let's try /pg first

    const resp = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
    });

    if (resp.ok) {
        const result = await resp.json();
        console.log(`   ✅ Success`);
        return result;
    }

    // If /pg doesn't work, try creating an exec_sql function via PostgREST
    const status = resp.status;
    const body = await resp.text();
    console.log(`   ⚠️  /pg/query returned ${status}: ${body.substring(0, 200)}`);
    return null;
}

async function createExecFunction() {
    // Create a helper function in Supabase that allows executing arbitrary SQL
    // This function runs as the postgres user (definer security)
    const createFnSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(query text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE query;
    END;
    $$;
  `;

    const resp = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: createFnSQL })
    });

    return resp.ok;
}

async function executeViaRpc(sql) {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
    });

    // Try calling exec_sql RPC function
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) {
        console.log(`   ⚠️  RPC exec_sql error: ${error.message}`);
        return false;
    }
    console.log(`   ✅ SQL executed via RPC`);
    return true;
}

async function main() {
    console.log('🔌 Setting up Supabase database...');
    console.log(`   URL: ${SUPABASE_URL}\n`);

    // Read schema SQL
    const schemaPath = path.join(__dirname, 'supabase-schema.sql');
    const fullSQL = fs.readFileSync(schemaPath, 'utf8');

    // Split SQL into individual statements for execution
    const statements = fullSQL
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    // Method 1: Try /pg/query endpoint with full SQL
    console.log('Method 1: Trying /pg/query endpoint...');
    const result = await executeSQL(fullSQL, 'Full schema execution');

    if (result) {
        console.log('\n🎉 All tables created successfully!');
        await verifyTables();
        return;
    }

    // Method 2: Try creating exec_sql function, then calling it via RPC
    console.log('\nMethod 2: Trying RPC approach...');
    const fnCreated = await createExecFunction();
    if (fnCreated) {
        console.log('   ✅ exec_sql function created');
        // Execute each statement via RPC
        for (const stmt of statements) {
            const ok = await executeViaRpc(stmt + ';');
            if (!ok) console.log(`   ⚠️  Failed statement: ${stmt.substring(0, 80)}...`);
        }
        await verifyTables();
        return;
    }

    // Method 3: Execute each statement individually via /pg/query
    console.log('\nMethod 3: Trying statement-by-statement via /pg/query...');
    for (const stmt of statements) {
        await executeSQL(stmt + ';', stmt.substring(0, 60));
    }

    await verifyTables();
}

async function verifyTables() {
    console.log('\n📊 Verifying tables...');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
    });

    const tables = ['users', 'customers', 'products', 'quotations', 'invoices', 'payments', 'amc'];
    for (const t of tables) {
        const { data, error, count } = await supabase.from(t).select('*', { count: 'exact', head: true });
        if (error) {
            console.log(`  ${t}: ${error.message}`);
        } else {
            console.log(`  ${t}: ${count ?? '?'} rows`);
        }
    }
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
