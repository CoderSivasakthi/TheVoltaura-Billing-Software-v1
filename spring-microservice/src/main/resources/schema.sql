-- ══════════════════════════════════════════════════════════════
-- SolarOps Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor
-- Tables are created in the public schema (default)
-- Spring Boot ddl-auto=update will also auto-create/update these,
-- but running this first ensures correct types and constraints.
-- ══════════════════════════════════════════════════════════════

-- ── CUSTOMERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id            VARCHAR(36) PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255),
    phone         VARCHAR(30),
    city          VARCHAR(100),
    address       TEXT,
    gstin         VARCHAR(20),
    gst_status    VARCHAR(20)  DEFAULT 'Registered',
    balance       NUMERIC(12,2) DEFAULT 0,
    status        VARCHAR(20)  DEFAULT 'Active',
    created_at    TIMESTAMP    DEFAULT NOW()
);

-- ── INVOICES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id              VARCHAR(36) PRIMARY KEY,
    customer_id     VARCHAR(36) REFERENCES customers(id) ON DELETE SET NULL,
    customer_name   VARCHAR(255),
    subtotal        NUMERIC(12,2),
    gst             NUMERIC(12,2),
    total           NUMERIC(12,2),
    supply_type     VARCHAR(10)  DEFAULT 'intra',
    status          VARCHAR(20)  DEFAULT 'Pending',
    invoice_date    DATE         DEFAULT CURRENT_DATE,
    due_date        DATE,
    notes           TEXT,
    created_at      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status);

-- ── QUOTATIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
    id            VARCHAR(36) PRIMARY KEY,
    customer_id   VARCHAR(36) REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255),
    subtotal      NUMERIC(12,2),
    gst           NUMERIC(12,2),
    discount      NUMERIC(12,2) DEFAULT 0,
    total         NUMERIC(12,2),
    status        VARCHAR(20)  DEFAULT 'Draft',
    quote_date    DATE         DEFAULT CURRENT_DATE,
    valid_until   DATE,
    notes         TEXT,
    created_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);

-- ── PRODUCTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id          VARCHAR(36) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    sku         VARCHAR(50),
    brand       VARCHAR(100),
    category    VARCHAR(80),
    gst_rate    NUMERIC(5,2) DEFAULT 18,
    price       NUMERIC(12,2),
    stock       INTEGER      DEFAULT 0,
    status      VARCHAR(20)  DEFAULT 'Active',
    description TEXT,
    created_at  TIMESTAMP    DEFAULT NOW()
);

-- ── PAYMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id            VARCHAR(36) PRIMARY KEY,
    invoice_id    VARCHAR(36) REFERENCES invoices(id) ON DELETE SET NULL,
    customer_id   VARCHAR(36) REFERENCES customers(id) ON DELETE SET NULL,
    amount        NUMERIC(12,2) NOT NULL,
    method        VARCHAR(30) DEFAULT 'Cash',
    payment_date  DATE        DEFAULT CURRENT_DATE,
    reference     VARCHAR(100),
    notes         TEXT,
    created_at    TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

-- ── AMC CONTRACTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amc_contracts (
    id            VARCHAR(36) PRIMARY KEY,
    customer_id   VARCHAR(36) REFERENCES customers(id) ON DELETE SET NULL,
    customer      VARCHAR(255),
    site          VARCHAR(100),
    status        VARCHAR(20) DEFAULT 'Active',
    start_date    DATE        DEFAULT CURRENT_DATE,
    expiry_date   DATE,
    next_service  DATE,
    system_kw     NUMERIC(7,2),
    annual_value  NUMERIC(12,2),
    panel_count   INTEGER,
    notes         TEXT,
    created_at    TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amc_customer ON amc_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_amc_status   ON amc_contracts(status);

-- ══════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — optional, disable for dev
-- Supabase enables RLS by default; disable for internal API use
-- ══════════════════════════════════════════════════════════════
ALTER TABLE customers     DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices      DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations    DISABLE ROW LEVEL SECURITY;
ALTER TABLE products      DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments      DISABLE ROW LEVEL SECURITY;
ALTER TABLE amc_contracts DISABLE ROW LEVEL SECURITY;
