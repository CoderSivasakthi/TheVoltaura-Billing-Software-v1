-- ═══════════════════════════════════════════════════════════════════════
-- TheVoltaura Solar ERP — Supabase Schema v2
-- Run this entire script in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy search

-- ═══════════════════════════════════════════════════════════════════════
-- 1. USERS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY DEFAULT 'USR-' || LPAD(nextval('users_seq')::text, 6, '0'),
    username    TEXT UNIQUE NOT NULL,
    email       TEXT UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user' | 'viewer'
    full_name   TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS users_seq START 1;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. SETTINGS (single global row)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS settings (
    id              TEXT PRIMARY KEY DEFAULT 'global',
    global_settings JSONB DEFAULT '{}',
    -- Additional global settings can be added here
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO settings (id, global_settings)
VALUES ('global', '{}')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. CUSTOMERS
-- ═══════════════════════════════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS customers_seq START 1;

CREATE TABLE IF NOT EXISTS customers (
    id              TEXT PRIMARY KEY,
    customer_code   TEXT UNIQUE NOT NULL, -- CUST-000001 — immutable
    name            JSONB DEFAULT '{}',   -- { firstName, lastName, companyName }
    email           TEXT,
    phone           TEXT,
    mobile          TEXT,
    address         TEXT,
    billing_address TEXT,
    site_address    TEXT,
    city            TEXT,
    state           TEXT,
    pincode         TEXT,
    -- Customers automatically get folder structures organized by customer_code
    -- Status
    status          TEXT DEFAULT 'Active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers USING GIN (name);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. CUSTOMER DOCUMENTS (Drive metadata only)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS customer_documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    document_type       TEXT NOT NULL, -- 'pan' | 'aadhaar' | 'eb_receipt' | 'bank_passbook' | 'rooftop_gps' | 'house_front' | 'eb_meter' | 'other'
    file_name           TEXT NOT NULL,
    original_file_name  TEXT,
    mime_type           TEXT,
    file_size_bytes     BIGINT,
    supabase_storage_path TEXT,
    file_url            TEXT,
    -- Audit
    uploaded_by         TEXT,  -- username
    uploaded_by_ip      TEXT,
    uploaded_at         TIMESTAMPTZ DEFAULT NOW(),
    is_deleted          BOOLEAN DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    deleted_by          TEXT,
    notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_docs_customer ON customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_docs_type ON customer_documents(document_type);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. PRODUCTS
-- ═══════════════════════════════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS products_seq START 1;

CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    category    TEXT,  -- 'Panels' | 'Inverter' | 'Battery' | 'Cables' | 'Accessories'
    sku         TEXT UNIQUE,
    hsn_code    TEXT,
    price       NUMERIC(12,2) DEFAULT 0,
    gst_rate    NUMERIC(5,2) DEFAULT 18,
    stock       INTEGER DEFAULT 0,
    min_stock   INTEGER DEFAULT 5,
    unit        TEXT DEFAULT 'Nos',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 6. QUOTATIONS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quotations (
    id                  TEXT PRIMARY KEY,  -- QTVA202627001
    customer_id         TEXT REFERENCES customers(id),
    customer_name       TEXT,
    company_branch_id   TEXT,
    company_gst         TEXT,
    company_address     TEXT,
    date                DATE,
    valid_until         DATE,
    billing_addr        TEXT,
    site_addr           TEXT,
    project_type        TEXT DEFAULT 'Grid-Tie',
    client_category     TEXT DEFAULT 'Residential',
    system_size_kw      NUMERIC(8,2) DEFAULT 0,
    daily_generation    NUMERIC(8,2) DEFAULT 0,
    annual_generation   INTEGER DEFAULT 0,
    subtotal            NUMERIC(12,2) DEFAULT 0,
    discount            NUMERIC(12,2) DEFAULT 0,
    total_tax           NUMERIC(12,2) DEFAULT 0,
    gst_amount          NUMERIC(12,2) DEFAULT 0,
    grand_total         NUMERIC(12,2) DEFAULT 0,
    subsidy_amount      NUMERIC(12,2) DEFAULT 0,
    net_customer_cost   NUMERIC(12,2) DEFAULT 0,
    notes               TEXT,
    exclusions          TEXT,
    status              TEXT DEFAULT 'Draft',
    -- Linked records
    invoice_id          TEXT,
    -- Customer info snapshot
    customer_info       JSONB DEFAULT '{}',
    documents           JSONB DEFAULT '{}',  -- legacy: will be replaced by customer_documents table
    -- Drive archive
    latest_pdf_storage_path TEXT,
    pdf_version         INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(date);

-- ═══════════════════════════════════════════════════════════════════════
-- 7. QUOTATION ITEMS (normalized)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quotation_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id    TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id      TEXT,
    product_name    TEXT NOT NULL,
    description     TEXT,
    hsn_code        TEXT,
    qty             NUMERIC(10,2) DEFAULT 1,
    unit            TEXT DEFAULT 'Nos',
    price           NUMERIC(12,2) DEFAULT 0,
    gst_rate        NUMERIC(5,2) DEFAULT 18,
    amount          NUMERIC(12,2) GENERATED ALWAYS AS (qty * price) STORED,
    sort_order      INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quot_items_quot ON quotation_items(quotation_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 8. QUOTATION DOCUMENTS (auto-archived PDFs in Drive)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quotation_documents (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id            TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    customer_id             TEXT,
    version_number          INTEGER DEFAULT 1,
    file_name               TEXT NOT NULL,  -- QTVA202627001_v1.pdf
    supabase_storage_path   TEXT NOT NULL,
    file_url                TEXT,
    file_size_bytes         BIGINT,
    is_latest               BOOLEAN DEFAULT TRUE,
    archived_by             TEXT,
    archived_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quot_docs_quot ON quotation_documents(quotation_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 9. INVOICES
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS invoices (
    id                  TEXT PRIMARY KEY,  -- INVTVA202627001
    quotation_id        TEXT REFERENCES quotations(id),
    customer_id         TEXT REFERENCES customers(id),
    customer_name       TEXT,
    company_branch_id   TEXT,
    company_gst         TEXT,
    company_address     TEXT,
    date                DATE,
    due_date            DATE,
    billing_addr        TEXT,
    site_addr           TEXT,
    subtotal            NUMERIC(12,2) DEFAULT 0,
    discount            NUMERIC(12,2) DEFAULT 0,
    total_tax           NUMERIC(12,2) DEFAULT 0,
    grand_total         NUMERIC(12,2) DEFAULT 0,
    total               NUMERIC(12,2) DEFAULT 0,
    paid                NUMERIC(12,2) DEFAULT 0,
    balance             NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(total, 0) - COALESCE(paid, 0)) STORED,
    status              TEXT DEFAULT 'Pending',  -- 'Pending' | 'Partially Paid' | 'Paid' | 'Cancelled'
    notes               TEXT,
    -- Drive archive
    latest_pdf_storage_path TEXT,
    pdf_version         INTEGER DEFAULT 0,
    items               JSONB DEFAULT '[]',  -- legacy snapshot for PDF rendering
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_quotation ON invoices(quotation_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 10. INVOICE DOCUMENTS (auto-archived PDFs in Drive)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS invoice_documents (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id              TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    customer_id             TEXT,
    version_number          INTEGER DEFAULT 1,
    file_name               TEXT NOT NULL,  -- INVTVA202627001_v1.pdf
    supabase_storage_path   TEXT NOT NULL,
    file_url                TEXT,
    file_size_bytes         BIGINT,
    is_latest               BOOLEAN DEFAULT TRUE,
    archived_by             TEXT,
    archived_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 11. PAYMENTS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payments (
    id                  TEXT PRIMARY KEY,
    quotation_id        TEXT REFERENCES quotations(id),
    invoice_id          TEXT REFERENCES invoices(id),
    customer_id         TEXT REFERENCES customers(id),
    customer_name       TEXT,
    amount              NUMERIC(12,2) NOT NULL,
    payment_date        DATE,
    payment_mode        TEXT,  -- 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'DD' | 'NEFT' | 'RTGS' | 'IMPS'
    utr_number          TEXT,  -- UTR / transaction reference
    cheque_number       TEXT,
    bank_name           TEXT,
    payment_type        TEXT DEFAULT 'Advance',  -- 'Advance' | 'Milestone' | 'Final'
    milestone_stage     TEXT,  -- '10% Advance' | '70% Procurement' | etc.
    received_by         TEXT,
    remarks             TEXT,
    status              TEXT DEFAULT 'Confirmed',
    -- Payment proof in Drive
    proof_storage_path  TEXT,
    proof_url           TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_quotation ON payments(quotation_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 12. PAYMENT DOCUMENTS (proof files in Drive)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment_documents (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id              TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    customer_id             TEXT,
    file_name               TEXT NOT NULL,
    supabase_storage_path   TEXT NOT NULL,
    file_url                TEXT,
    file_size_bytes         BIGINT,
    uploaded_by             TEXT,
    uploaded_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 13. ORDERS (Priority Orders / Project Pipeline)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS orders (
    id                          TEXT PRIMARY KEY,  -- ORD-000001
    quotation_id                TEXT REFERENCES quotations(id),
    quotation_number            TEXT,
    customer_id                 TEXT REFERENCES customers(id),
    customer_name               TEXT,
    project_size                TEXT,
    grand_total                 NUMERIC(12,2),
    advance_amount              NUMERIC(12,2),
    payment_mode                TEXT,
    utr_number                  TEXT,
    received_by                 TEXT,
    payment_date                DATE,
    remarks                     TEXT,
    status                      TEXT DEFAULT 'Confirmed Order',
    project_status              TEXT DEFAULT 'Material Procurement',
    current_stage               TEXT DEFAULT 'Priority Orders',
    priority_level              TEXT DEFAULT 'Normal',  -- 'High' | 'Normal' | 'Low'
    priority_index              INTEGER DEFAULT 0,
    assigned_engineer           TEXT DEFAULT 'Unassigned',
    expected_installation_date  DATE,
    actual_completion_date      DATE,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority_index);

-- ═══════════════════════════════════════════════════════════════════════
-- 14. NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       TEXT NOT NULL,
    desc        TEXT,
    type        TEXT DEFAULT 'info',  -- 'info' | 'success' | 'warning' | 'danger'
    link        TEXT,
    read        BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 15. AUDIT LOGS (every file upload, download, delete)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action              TEXT NOT NULL,  -- 'upload' | 'download' | 'delete' | 'create' | 'update'
    entity_type         TEXT,           -- 'customer_document' | 'quotation_pdf' | 'invoice_pdf' | 'payment_proof'
    entity_id           TEXT,
    customer_id         TEXT,
    document_type       TEXT,
    supabase_storage_path TEXT,
    file_name           TEXT,
    performed_by        TEXT,           -- username
    ip_address          TEXT,
    user_agent          TEXT,
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_customer ON audit_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);

-- ═══════════════════════════════════════════════════════════════════════
-- 17. AMC (Annual Maintenance Contracts)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS amc (
    id              TEXT PRIMARY KEY,
    customer_id     TEXT REFERENCES customers(id),
    customer_name   TEXT,
    start_date      DATE,
    end_date        DATE,
    amount          NUMERIC(12,2),
    status          TEXT DEFAULT 'Active',
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- 18. JOURNAL & LEDGER (accounting trail)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS journal_entries (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date        TIMESTAMPTZ,
    narration   TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id  UUID REFERENCES journal_entries(id),
    account     TEXT,
    debit       NUMERIC(12,2) DEFAULT 0,
    credit      NUMERIC(12,2) DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- AUTO-UPDATE TIMESTAMPS TRIGGER
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════
-- CUSTOMER CODE SEQUENCE & AUTO-GENERATION
-- ═══════════════════════════════════════════════════════════════════════
CREATE SEQUENCE IF NOT EXISTS customer_code_seq START 1;

CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'CUST-' || LPAD(nextval('customer_code_seq')::text, 6, '0');
END;
$$ language 'plpgsql';

-- ═══════════════════════════════════════════════════════════════════════
-- RLS: Disabled for service_role (backend always uses service key)
-- Enable only if you add user-level auth via Supabase Auth later
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE amc DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries DISABLE ROW LEVEL SECURITY;
