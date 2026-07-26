-- ══════════════════════════════════════════════════════════════
-- SolarOps — Supabase Database Schema
-- ══════════════════════════════════════════════════════════════
-- HOW TO USE:
-- 1. Go to https://supabase.com/dashboard
-- 2. Open your project → SQL Editor
-- 3. Paste this ENTIRE file and click "Run"
-- 4. All tables will be created and RLS disabled
-- ══════════════════════════════════════════════════════════════

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username text UNIQUE NOT NULL,
  password text,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

-- ── CUSTOMERS ────────────────────────────────────────────────
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

-- ── PRODUCTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  sku text,
  brand text,
  category text,
  price numeric DEFAULT 0,
  gst_rate numeric DEFAULT 18,
  stock integer DEFAULT 0,
  gst text,
  status text DEFAULT 'Active',
  description text,
  created_at timestamptz DEFAULT now()
);

-- ── QUOTATIONS ───────────────────────────────────────────────
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

-- ── INVOICES ─────────────────────────────────────────────────
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

-- ── PAYMENTS ─────────────────────────────────────────────────
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

-- ── AMC CONTRACTS ────────────────────────────────────────────
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

-- ── JOURNAL ENTRIES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date timestamptz DEFAULT now(),
  narration text,
  created_at timestamptz DEFAULT now()
);

-- ── LEDGER ENTRIES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_entries (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  journal_id text,
  account text,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── SETTINGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  global_settings jsonb,
  created_at timestamptz DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
-- Disable Row Level Security (for internal API use)
-- ══════════════════════════════════════════════════════════════
ALTER TABLE users           DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers       DISABLE ROW LEVEL SECURITY;
ALTER TABLE products        DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations      DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices        DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments        DISABLE ROW LEVEL SECURITY;
ALTER TABLE amc             DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries  DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings        DISABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- SEED DATA — initial customers, products, invoices, AMC
-- ══════════════════════════════════════════════════════════════
INSERT INTO users (id, username, password, role) VALUES ('1', 'admin', '', 'admin') ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id, name, email, phone, city, gst, gstin, "gstStatus", status, balance) VALUES
  ('CUST-1', 'Sunlight Energy Pvt Ltd', 'info@sunlight.com', '9876543210', 'Chennai', '33ABCDE1234F1Z5', '33ABCDE1234F1Z5', 'Registered', 'Active', 125000),
  ('CUST-2', 'GreenWatt Solutions', 'contact@greenwatt.in', '9123456780', 'Coimbatore', '33FGHIJ5678K2Z6', '33FGHIJ5678K2Z6', 'Registered', 'Active', 78500),
  ('CUST-3', 'Ravi Solar Installation', 'ravi@solarinstall.com', '8765432109', 'Madurai', NULL, NULL, 'Unregistered', 'Active', 0),
  ('CUST-4', 'Tamil Nadu Solar Co-op', 'admin@tnsolar.org', '7654321098', 'Trichy', '33LMNOP9012Q3Z7', '33LMNOP9012Q3Z7', 'Registered', 'Active', 250000),
  ('CUST-5', 'Vijay Renewables', 'vijay@renewables.in', '6543210987', 'Salem', NULL, NULL, 'Unregistered', 'Active', 45000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, name, sku, brand, category, price, gst_rate, stock, status) VALUES
  ('PROD-1', 'Monocrystalline Solar Panel 545W', 'SP-MONO-545', 'Adani Solar', 'Solar Panels', 22500, 12, 45, 'Active'),
  ('PROD-2', 'Polycrystalline Panel 330W', 'SP-POLY-330', 'Tata Power Solar', 'Solar Panels', 14000, 12, 30, 'Active'),
  ('PROD-3', 'On-Grid Inverter 5kW', 'INV-OG-5KW', 'Growatt', 'Inverters', 45000, 18, 12, 'Active'),
  ('PROD-4', 'Hybrid Inverter 10kW', 'INV-HY-10KW', 'Goodwe', 'Inverters', 85000, 18, 5, 'Active'),
  ('PROD-5', 'Lithium Battery 5kWh', 'BAT-LI-5KWH', 'Luminous', 'Batteries', 120000, 18, 3, 'Active'),
  ('PROD-6', 'MC4 Connector Pair', 'ACC-MC4', 'Generic', 'Accessories', 150, 18, 200, 'Active'),
  ('PROD-7', 'DC Cable 4mm (100m)', 'ACC-DC4-100', 'Polycab', 'Accessories', 3500, 18, 25, 'Active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (id, "customerId", "customerName", subtotal, gst, total, status, created_at) VALUES
  ('INV-1', 'CUST-1', 'Sunlight Energy Pvt Ltd', 225000, 27000, 252000, 'Paid', '2026-01-15T10:00:00Z'),
  ('INV-2', 'CUST-2', 'GreenWatt Solutions', 90000, 16200, 106200, 'Pending', '2026-02-01T11:30:00Z'),
  ('INV-3', 'CUST-4', 'Tamil Nadu Solar Co-op', 255000, 45900, 300900, 'Overdue', '2025-12-20T09:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO amc (id, "customerId", customer, site, status, "startDate", expiry, "nextService", "systemKw", "annualValue", "panelCount") VALUES
  ('AMC-1', 'CUST-1', 'Sunlight Energy Pvt Ltd', 'Factory Rooftop', 'Active', '2025-06-01', '2026-06-01', '2026-03-15', 50, 35000, 90),
  ('AMC-2', 'CUST-4', 'Tamil Nadu Solar Co-op', 'Community Center', 'Expiring Soon', '2025-01-01', '2026-03-01', '2026-02-20', 20, 15000, 36)
ON CONFLICT (id) DO NOTHING;
