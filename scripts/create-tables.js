/**
 * Create all SolarOps tables in Supabase via the REST/SQL API.
 * Uses fetch to POST DDL statements to the Supabase SQL endpoint.
 * Run: node scripts/create-tables.js
 */
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// We'll create tables by attempting to insert+delete a test row,
// and if the table doesn't exist, we'll use the SQL endpoint.
// Supabase provides a REST endpoint for executing SQL: POST /rest/v1/rpc/...
// But the cleanest approach is to use the Supabase service role + SQL.
// Since we only have the anon key, we'll create tables using the
// Supabase Dashboard SQL Editor instead.

// ALTERNATIVE: Attempt to create a Postgres function that creates tables
// via rpc(), then call it.

async function createTablesViaSql() {
    const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      username text UNIQUE NOT NULL,
      password text,
      role text DEFAULT 'user',
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS customers (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name text NOT NULL,
      email text,
      phone text,
      gst text,
      gstin text,
      "gstStatus" text DEFAULT 'Registered',
      city text,
      address text,
      balance numeric DEFAULT 0,
      status text DEFAULT 'Active',
      "totalRevenue" numeric DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS products (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name text NOT NULL,
      sku text,
      brand text,
      category text,
      price numeric DEFAULT 0,
      "gst_rate" numeric DEFAULT 18,
      stock integer DEFAULT 0,
      gst text,
      status text DEFAULT 'Active',
      description text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      customer jsonb,
      "customerId" text,
      "customerName" text,
      items jsonb,
      subtotal numeric DEFAULT 0,
      gst numeric DEFAULT 0,
      discount numeric DEFAULT 0,
      total numeric DEFAULT 0,
      status text DEFAULT 'Draft',
      notes text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "quotationId" text,
      customer jsonb,
      "customerId" text,
      "customerName" text,
      items jsonb,
      subtotal numeric DEFAULT 0,
      gst numeric DEFAULT 0,
      total numeric DEFAULT 0,
      paid numeric DEFAULT 0,
      "supplyType" text DEFAULT 'intra',
      status text DEFAULT 'Pending',
      "invoiceDate" text,
      "dueDate" text,
      notes text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS payments (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "invoiceId" text,
      "customerId" text,
      amount numeric DEFAULT 0,
      method text DEFAULT 'Cash',
      date timestamptz DEFAULT now(),
      reference text,
      notes text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS amc (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "customerId" text,
      customer text,
      site text,
      status text DEFAULT 'Active',
      "startDate" text,
      expiry text,
      "nextService" text,
      "systemKw" numeric,
      "annualValue" numeric,
      "panelCount" integer,
      notes text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      date timestamptz DEFAULT now(),
      narration text,
      created_at timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      journal_id text,
      account text,
      debit numeric DEFAULT 0,
      credit numeric DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );
  `;

    // Try using Supabase's SQL endpoint via fetch
    // The endpoint is: POST https://<project>.supabase.co/rest/v1/rpc
    // But that requires a custom function. Let's try the SQL execution API.
    // Supabase exposes: POST /pg/query (service_role only) or we can use fetch to the Management API.

    // Approach: Use native fetch to the Supabase SQL API
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
    });

    // If the SQL endpoint isn't available (it usually requires service_role), 
    // fall back to creating tables one by one via individual API calls
    if (!resp.ok) {
        console.log('Direct SQL execution not available via anon key (expected).');
        console.log('Trying table-by-table validation...');
        await validateTables();
        return;
    }

    const result = await resp.json();
    console.log('Tables created via SQL:', result);
}

async function validateTables() {
    const tables = ['users', 'customers', 'products', 'quotations', 'invoices', 'payments', 'amc', 'journal_entries', 'ledger_entries'];

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('id').limit(1);
        if (error) {
            if (error.code === 'PGRST205' || error.code === '42P01') {
                console.log(`  ❌ Table "${table}" does NOT exist — needs to be created in Supabase SQL Editor`);
            } else {
                console.log(`  ⚠️  Table "${table}" error: ${error.message}`);
            }
        } else {
            console.log(`  ✅ Table "${table}" exists (${(data || []).length} rows sampled)`);
        }
    }
}

async function seedData() {
    console.log('\nSeeding initial data...');

    // Seed customers
    const { data: custCheck } = await supabase.from('customers').select('id').limit(1);
    if (!custCheck || custCheck.length === 0) {
        const customers = [
            { id: 'CUST-1', name: 'Sunlight Energy Pvt Ltd', email: 'info@sunlight.com', phone: '9876543210', city: 'Chennai', gst: '33ABCDE1234F1Z5', gstin: '33ABCDE1234F1Z5', gstStatus: 'Registered', status: 'Active', balance: 125000 },
            { id: 'CUST-2', name: 'GreenWatt Solutions', email: 'contact@greenwatt.in', phone: '9123456780', city: 'Coimbatore', gst: '33FGHIJ5678K2Z6', gstin: '33FGHIJ5678K2Z6', gstStatus: 'Registered', status: 'Active', balance: 78500 },
            { id: 'CUST-3', name: 'Ravi Solar Installation', email: 'ravi@solarinstall.com', phone: '8765432109', city: 'Madurai', status: 'Active', balance: 0 },
            { id: 'CUST-4', name: 'Tamil Nadu Solar Co-op', email: 'admin@tnsolar.org', phone: '7654321098', city: 'Trichy', gst: '33LMNOP9012Q3Z7', gstin: '33LMNOP9012Q3Z7', gstStatus: 'Registered', status: 'Active', balance: 250000 },
            { id: 'CUST-5', name: 'Vijay Renewables', email: 'vijay@renewables.in', phone: '6543210987', city: 'Salem', status: 'Active', balance: 45000 }
        ];
        const { error } = await supabase.from('customers').upsert(customers, { onConflict: 'id' });
        if (error) console.log('  ⚠️  Customers seed error:', error.message);
        else console.log('  ✅ Seeded 5 customers');
    } else {
        console.log('  ⏭️  Customers already have data, skipping seed');
    }

    // Seed products
    const { data: prodCheck } = await supabase.from('products').select('id').limit(1);
    if (!prodCheck || prodCheck.length === 0) {
        const products = [
            { id: 'PROD-1', name: 'Monocrystalline Solar Panel 545W', sku: 'SP-MONO-545', brand: 'Adani Solar', category: 'Solar Panels', price: 22500, gst_rate: 12, stock: 45, status: 'Active' },
            { id: 'PROD-2', name: 'Polycrystalline Panel 330W', sku: 'SP-POLY-330', brand: 'Tata Power Solar', category: 'Solar Panels', price: 14000, gst_rate: 12, stock: 30, status: 'Active' },
            { id: 'PROD-3', name: 'On-Grid Inverter 5kW', sku: 'INV-OG-5KW', brand: 'Growatt', category: 'Inverters', price: 45000, gst_rate: 18, stock: 12, status: 'Active' },
            { id: 'PROD-4', name: 'Hybrid Inverter 10kW', sku: 'INV-HY-10KW', brand: 'Goodwe', category: 'Inverters', price: 85000, gst_rate: 18, stock: 5, status: 'Active' },
            { id: 'PROD-5', name: 'Lithium Battery 5kWh', sku: 'BAT-LI-5KWH', brand: 'Luminous', category: 'Batteries', price: 120000, gst_rate: 18, stock: 3, status: 'Active' },
            { id: 'PROD-6', name: 'MC4 Connector Pair', sku: 'ACC-MC4', brand: 'Generic', category: 'Accessories', price: 150, gst_rate: 18, stock: 200, status: 'Active' },
            { id: 'PROD-7', name: 'DC Cable 4mm (100m)', sku: 'ACC-DC4-100', brand: 'Polycab', category: 'Accessories', price: 3500, gst_rate: 18, stock: 25, status: 'Active' }
        ];
        const { error } = await supabase.from('products').upsert(products, { onConflict: 'id' });
        if (error) console.log('  ⚠️  Products seed error:', error.message);
        else console.log('  ✅ Seeded 7 products');
    } else {
        console.log('  ⏭️  Products already have data, skipping seed');
    }

    // Seed invoices
    const { data: invCheck } = await supabase.from('invoices').select('id').limit(1);
    if (!invCheck || invCheck.length === 0) {
        const invoices = [
            { id: 'INV-1', customerId: 'CUST-1', customer: { name: 'Sunlight Energy Pvt Ltd' }, customerName: 'Sunlight Energy Pvt Ltd', items: [{ product: 'Monocrystalline Solar Panel 545W', qty: 10, price: 22500, gst: 12 }], subtotal: 225000, gst: 27000, total: 252000, status: 'Paid', createdAt: '2026-01-15T10:00:00Z' },
            { id: 'INV-2', customerId: 'CUST-2', customer: { name: 'GreenWatt Solutions' }, customerName: 'GreenWatt Solutions', items: [{ product: 'On-Grid Inverter 5kW', qty: 2, price: 45000, gst: 18 }], subtotal: 90000, gst: 16200, total: 106200, status: 'Pending', createdAt: '2026-02-01T11:30:00Z' },
            { id: 'INV-3', customerId: 'CUST-4', customer: { name: 'Tamil Nadu Solar Co-op' }, customerName: 'Tamil Nadu Solar Co-op', items: [{ product: 'Hybrid Inverter 10kW', qty: 3, price: 85000, gst: 18 }], subtotal: 255000, gst: 45900, total: 300900, status: 'Overdue', createdAt: '2025-12-20T09:00:00Z' }
        ];
        const { error } = await supabase.from('invoices').upsert(invoices, { onConflict: 'id' });
        if (error) console.log('  ⚠️  Invoices seed error:', error.message);
        else console.log('  ✅ Seeded 3 invoices');
    } else {
        console.log('  ⏭️  Invoices already have data, skipping seed');
    }

    // Seed AMC
    const { data: amcCheck } = await supabase.from('amc').select('id').limit(1);
    if (!amcCheck || amcCheck.length === 0) {
        const amc = [
            { id: 'AMC-1', customerId: 'CUST-1', customer: 'Sunlight Energy Pvt Ltd', site: 'Factory Rooftop', status: 'Active', startDate: '2025-06-01', expiry: '2026-06-01', nextService: '2026-03-15', systemKw: 50, annualValue: 35000, panelCount: 90 },
            { id: 'AMC-2', customerId: 'CUST-4', customer: 'Tamil Nadu Solar Co-op', site: 'Community Center', status: 'Expiring Soon', startDate: '2025-01-01', expiry: '2026-03-01', nextService: '2026-02-20', systemKw: 20, annualValue: 15000, panelCount: 36 }
        ];
        const { error } = await supabase.from('amc').upsert(amc, { onConflict: 'id' });
        if (error) console.log('  ⚠️  AMC seed error:', error.message);
        else console.log('  ✅ Seeded 2 AMC contracts');
    } else {
        console.log('  ⏭️  AMC already has data, skipping seed');
    }

    console.log('\n✅ Seed complete!\n');
}

async function main() {
    console.log('🔌 Testing Supabase connection...');
    console.log(`   URL: ${SUPABASE_URL}`);
    console.log('');

    await createTablesViaSql();

    console.log('\n📋 Table validation:');
    await validateTables();

    // If tables exist, seed
    const { data, error } = await supabase.from('customers').select('id').limit(1);
    if (!error) {
        await seedData();
    } else {
        console.log('\n⚠️  Tables not found. You need to run the SQL schema in Supabase Dashboard.');
        console.log('   Go to: https://supabase.com/dashboard → Your Project → SQL Editor');
        console.log('   Paste the contents of: scripts/supabase-schema.sql');
        console.log('   Then run this script again.\n');
    }
}

main().catch(e => { console.error(e); process.exit(1); });
