-- ═══════════════════════════════════════════════════════════════════════
-- 000. SECURITY & ARCHITECTURE NOTES
-- ═══════════════════════════════════════════════════════════════════════
-- Note on Row Level Security (RLS):
-- RLS is intentionally DISABLED for all tables in this schema (public.*).
-- This ERP uses a STRICT Backend-Only architecture:
--   1. Frontend React app NEVER connects directly to Supabase.
--   2. Node.js Backend performs all Database/Storage operations.
--   3. Backend uses the SUPABASE_SERVICE_ROLE_KEY which bypasses RLS anyway.
--   4. Authentication and Authorization are handled completely by the Node.js API layer.
--
-- If a Customer Portal or Mobile App is developed in the future with direct
-- Supabase client access, RLS MUST be enabled and policies implemented then.
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- 001. EXTENSIONS & GENERIC FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════
-- ── Extensions ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy search

-- ── Generic Functions ───────────────────────────────────────────────────

-- 1. Auto-Update Timestamp Function
-- Used by triggers to automatically update the updated_at column on UPDATE.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Generate Customer Code Function
-- Generates CUST-000001 format codes automatically.
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
DECLARE
    next_val INT;
BEGIN
    -- If customer_code is not provided, generate one
    IF NEW.customer_code IS NULL THEN
        -- Safely get next value from the sequence
        SELECT nextval('customers_seq') INTO next_val;
        NEW.customer_code := 'CUST-' || LPAD(next_val::TEXT, 6, '0');
    END IF;
    
    -- If id is not provided, make it equal to customer_code
    IF NEW.id IS NULL THEN
        NEW.id := NEW.customer_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- ═══════════════════════════════════════════════════════════════════════
-- 002. SEQUENCES
-- ═══════════════════════════════════════════════════════════════════════

-- Ensure all sequences are created before the tables that reference them.

CREATE SEQUENCE IF NOT EXISTS users_seq START 1;
CREATE SEQUENCE IF NOT EXISTS customers_seq START 1;
CREATE SEQUENCE IF NOT EXISTS products_seq START 1;
CREATE SEQUENCE IF NOT EXISTS quotations_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoices_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payments_seq START 1;
CREATE SEQUENCE IF NOT EXISTS orders_seq START 1;
-- ═══════════════════════════════════════════════════════════════════════
-- 003. CORE SETUP (Company, Branches, Banks)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Company Settings
CREATE TABLE IF NOT EXISTS company_settings (
    id              TEXT PRIMARY KEY DEFAULT 'global',
    company_name    TEXT NOT NULL,
    logo_url        TEXT,
    website         TEXT,
    support_email   TEXT,
    support_phone   TEXT,
    timezone        TEXT DEFAULT 'Asia/Kolkata',
    currency        TEXT DEFAULT 'INR',
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO company_settings (id, company_name)
VALUES ('global', 'TheVoltaura Solar')
ON CONFLICT (id) DO NOTHING;

-- 2. Company Branches
CREATE TABLE IF NOT EXISTS company_branches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_name     TEXT NOT NULL,
    branch_code     TEXT UNIQUE NOT NULL,
    gstin           TEXT,
    address         TEXT,
    city            TEXT,
    state           TEXT,
    pincode         TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    is_head_office  BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id       UUID REFERENCES company_branches(id) ON DELETE SET NULL,
    bank_name       TEXT NOT NULL,
    account_name    TEXT NOT NULL,
    account_number  TEXT NOT NULL,
    ifsc_code       TEXT NOT NULL,
    swift_code      TEXT,
    branch_address  TEXT,
    is_default      BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Document Numbering Configuration
CREATE TABLE IF NOT EXISTS document_numbering (
    id              TEXT PRIMARY KEY, -- 'quotation', 'invoice', 'payment'
    prefix          TEXT NOT NULL,
    financial_year  TEXT NOT NULL, -- e.g. '2026-27'
    current_sequence INTEGER DEFAULT 1,
    padding         INTEGER DEFAULT 3,
    suffix          TEXT,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO document_numbering (id, prefix, financial_year, current_sequence)
VALUES 
    ('quotation', 'QTVA', '2026-27', 1),
    ('invoice', 'INVTVA', '2026-27', 1),
    ('payment', 'PAYVA', '2026-27', 1)
ON CONFLICT (id) DO NOTHING;

-- 5. Default Payment Terms
CREATE TABLE IF NOT EXISTS default_payment_terms (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term_name       TEXT NOT NULL, -- 'Standard EPC', 'Government Project'
    milestones      JSONB DEFAULT '[]', -- Array of { percentage, description }
    is_default      BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
-- ═══════════════════════════════════════════════════════════════════════
-- 004. USERS & AUTH
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY DEFAULT 'USR-' || LPAD(nextval('users_seq')::text, 6, '0'),
    username    TEXT UNIQUE NOT NULL,
    email       TEXT UNIQUE,
    password    TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'user',
    full_name   TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_user_role CHECK (role IN ('admin', 'user', 'viewer'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- ═══════════════════════════════════════════════════════════════════════
-- 005. CUSTOMERS
-- ═══════════════════════════════════════════════════════════════════════

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
    status          TEXT DEFAULT 'Active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_customer_status CHECK (status IN ('Active', 'Inactive', 'Lead'))
);

CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers USING GIN (name);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- Trigger to auto-generate CUST- ID
DROP TRIGGER IF EXISTS trg_generate_customer_code ON customers;
CREATE TRIGGER trg_generate_customer_code
    BEFORE INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION generate_customer_code();
-- ═══════════════════════════════════════════════════════════════════════
-- 006. PRODUCTS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY DEFAULT 'PROD-' || LPAD(nextval('products_seq')::text, 6, '0'),
    name        TEXT NOT NULL,
    description TEXT,
    category    TEXT, 
    sku         TEXT UNIQUE,
    hsn_code    TEXT,
    price       NUMERIC(12,2) DEFAULT 0,
    gst_rate    NUMERIC(5,2) DEFAULT 18,
    stock       INTEGER DEFAULT 0,
    min_stock   INTEGER DEFAULT 5,
    unit        TEXT DEFAULT 'Nos',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_product_category CHECK (category IN ('Panels', 'Inverter', 'Battery', 'Cables', 'Accessories', 'Other'))
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
-- ═══════════════════════════════════════════════════════════════════════
-- 007. QUOTATIONS
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Document ID Generator Function ──────────────────────────────────
CREATE OR REPLACE FUNCTION generate_document_id()
RETURNS TRIGGER AS $$
DECLARE
    doc_prefix TEXT;
    doc_fy TEXT;
    doc_seq INT;
    doc_padding INT;
    doc_suffix TEXT;
    final_id TEXT;
    doc_type TEXT;
BEGIN
    -- Determine type based on table name
    IF TG_TABLE_NAME = 'quotations' THEN
        doc_type := 'quotation';
    ELSIF TG_TABLE_NAME = 'invoices' THEN
        doc_type := 'invoice';
    ELSIF TG_TABLE_NAME = 'payments' THEN
        doc_type := 'payment';
    END IF;

    IF NEW.id IS NULL THEN
        -- Lock row for concurrency
        SELECT prefix, financial_year, current_sequence, padding, suffix
        INTO doc_prefix, doc_fy, doc_seq, doc_padding, doc_suffix
        FROM document_numbering
        WHERE id = doc_type
        FOR UPDATE;
        
        IF NOT FOUND THEN
            -- Fallback
            doc_prefix := UPPER(SUBSTRING(TG_TABLE_NAME, 1, 3));
            doc_fy := TO_CHAR(NOW(), 'YYYY');
            doc_seq := nextval(TG_TABLE_NAME || '_seq');
            doc_padding := 4;
            doc_suffix := '';
        ELSE
            -- Update sequence
            UPDATE document_numbering 
            SET current_sequence = current_sequence + 1, updated_at = NOW()
            WHERE id = doc_type;
        END IF;
        
        -- Build ID (e.g. QTVA2026-27001)
        -- Removing hyphen from FY for standard format QTVA202627001
        final_id := doc_prefix || REPLACE(doc_fy, '-', '') || LPAD(doc_seq::TEXT, doc_padding, '0') || COALESCE(doc_suffix, '');
        NEW.id := final_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. Quotations Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
    id                  TEXT PRIMARY KEY,
    customer_id         TEXT REFERENCES customers(id) ON DELETE RESTRICT,
    customer_name       TEXT,
    company_branch_id   UUID REFERENCES company_branches(id) ON DELETE SET NULL,
    company_gst         TEXT,
    company_address     TEXT,
    document_date       DATE DEFAULT CURRENT_DATE,
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
    invoice_id          TEXT,
    customer_info       JSONB DEFAULT '{}',
    latest_pdf_storage_path TEXT,
    pdf_version         INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_quotation_status CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted'))
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(document_date);
CREATE INDEX IF NOT EXISTS idx_quotations_branch ON quotations(company_branch_id);

-- Apply auto-ID trigger
DROP TRIGGER IF EXISTS trg_generate_quotation_id ON quotations;
CREATE TRIGGER trg_generate_quotation_id
    BEFORE INSERT ON quotations
    FOR EACH ROW
    EXECUTE FUNCTION generate_document_id();

-- ── 3. Quotation Items ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotation_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id    TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    product_id      TEXT REFERENCES products(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_quot_items_prod ON quotation_items(product_id);
-- ═══════════════════════════════════════════════════════════════════════
-- 008. INVOICES
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Invoices Table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id                  TEXT PRIMARY KEY,  -- INVTVA202627001
    quotation_id        TEXT REFERENCES quotations(id) ON DELETE SET NULL,
    customer_id         TEXT REFERENCES customers(id) ON DELETE RESTRICT,
    customer_name       TEXT,
    company_branch_id   UUID REFERENCES company_branches(id) ON DELETE SET NULL,
    company_gst         TEXT,
    company_address     TEXT,
    document_date       DATE DEFAULT CURRENT_DATE,
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
    status              TEXT DEFAULT 'Pending',
    notes               TEXT,
    latest_pdf_storage_path TEXT,
    pdf_version         INTEGER DEFAULT 0,
    items               JSONB DEFAULT '[]',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_invoice_status CHECK (status IN ('Draft', 'Pending', 'Partially Paid', 'Paid', 'Cancelled', 'Overdue'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_quotation ON invoices(quotation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(document_date);

-- Apply auto-ID trigger
DROP TRIGGER IF EXISTS trg_generate_invoice_id ON invoices;
CREATE TRIGGER trg_generate_invoice_id
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION generate_document_id();

-- ── 2. Invoice Items (Normalized) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id      TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id      TEXT REFERENCES products(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_inv_items_inv ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_prod ON invoice_items(product_id);
-- ═══════════════════════════════════════════════════════════════════════
-- 009. PAYMENTS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payments (
    id                  TEXT PRIMARY KEY,
    quotation_id        TEXT REFERENCES quotations(id) ON DELETE SET NULL,
    invoice_id          TEXT REFERENCES invoices(id) ON DELETE SET NULL,
    customer_id         TEXT REFERENCES customers(id) ON DELETE RESTRICT,
    customer_name       TEXT,
    amount              NUMERIC(12,2) NOT NULL,
    document_date       DATE DEFAULT CURRENT_DATE,
    payment_mode        TEXT,
    utr_number          TEXT,  
    cheque_number       TEXT,
    bank_name           TEXT,
    payment_type        TEXT DEFAULT 'Advance', 
    milestone_stage     TEXT,  
    received_by         TEXT,
    remarks             TEXT,
    status              TEXT DEFAULT 'Confirmed',
    proof_storage_path  TEXT,
    proof_url           TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_payment_mode CHECK (payment_mode IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'DD', 'NEFT', 'RTGS', 'IMPS', 'Other')),
    CONSTRAINT chk_payment_type CHECK (payment_type IN ('Advance', 'Milestone', 'Final', 'Other')),
    CONSTRAINT chk_payment_status CHECK (status IN ('Pending', 'Confirmed', 'Failed', 'Refunded'))
);

CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_quotation ON payments(quotation_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(document_date);

-- Apply auto-ID trigger
DROP TRIGGER IF EXISTS trg_generate_payment_id ON payments;
CREATE TRIGGER trg_generate_payment_id
    BEFORE INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION generate_document_id();
-- ═══════════════════════════════════════════════════════════════════════
-- 010. ORDERS & AMC
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Orders Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY DEFAULT 'ORD-' || LPAD(nextval('orders_seq')::text, 6, '0'),
    quotation_id    TEXT REFERENCES quotations(id) ON DELETE RESTRICT,
    customer_id     TEXT REFERENCES customers(id) ON DELETE RESTRICT,
    priority        TEXT DEFAULT 'Normal',
    order_status    TEXT DEFAULT 'Pending',
    assigned_to     TEXT,
    target_date     DATE,
    completed_date  DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_order_priority CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    CONSTRAINT chk_order_status CHECK (order_status IN ('Pending', 'In Progress', 'Completed', 'Cancelled', 'On Hold'))
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_quotation ON orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);

-- ── 2. AMC Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amc (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     TEXT REFERENCES customers(id) ON DELETE CASCADE,
    quotation_id    TEXT REFERENCES quotations(id) ON DELETE SET NULL,
    start_date      DATE,
    end_date        DATE,
    amount          NUMERIC(12,2),
    status          TEXT DEFAULT 'Active',
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_amc_status CHECK (status IN ('Active', 'Expired', 'Cancelled', 'Pending Renewal'))
);

CREATE INDEX IF NOT EXISTS idx_amc_customer ON amc(customer_id);
CREATE INDEX IF NOT EXISTS idx_amc_status ON amc(status);
-- ═══════════════════════════════════════════════════════════════════════
-- 011. STORAGE METADATA
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Customer Documents ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    document_type       TEXT NOT NULL,
    file_name           TEXT NOT NULL,
    original_file_name  TEXT,
    mime_type           TEXT,
    file_size_bytes     BIGINT,
    supabase_storage_path TEXT NOT NULL,
    uploaded_by         TEXT,
    uploaded_by_ip      TEXT,
    uploaded_at         TIMESTAMPTZ DEFAULT NOW(),
    is_deleted          BOOLEAN DEFAULT FALSE,
    deleted_at          TIMESTAMPTZ,
    deleted_by          TEXT,
    notes               TEXT,

    CONSTRAINT chk_doc_type CHECK (document_type IN ('pan', 'aadhaar', 'eb_receipt', 'bank_passbook', 'rooftop_gps', 'house_front', 'eb_meter', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_customer_docs_customer ON customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_docs_type ON customer_documents(document_type);

-- ── 2. Quotation Documents ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotation_documents (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quotation_id            TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    customer_id             TEXT REFERENCES customers(id) ON DELETE SET NULL,
    version_number          INTEGER DEFAULT 1,
    file_name               TEXT NOT NULL,
    supabase_storage_path   TEXT NOT NULL,
    file_size_bytes         BIGINT,
    is_latest               BOOLEAN DEFAULT TRUE,
    archived_by             TEXT,
    archived_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quot_docs_quot ON quotation_documents(quotation_id);

-- ── 3. Invoice Documents ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_documents (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id              TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    customer_id             TEXT REFERENCES customers(id) ON DELETE SET NULL,
    version_number          INTEGER DEFAULT 1,
    file_name               TEXT NOT NULL,
    supabase_storage_path   TEXT NOT NULL,
    file_size_bytes         BIGINT,
    is_latest               BOOLEAN DEFAULT TRUE,
    archived_by             TEXT,
    archived_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_docs_inv ON invoice_documents(invoice_id);

-- ── 4. Payment Documents ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_documents (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id              TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    customer_id             TEXT REFERENCES customers(id) ON DELETE SET NULL,
    file_name               TEXT NOT NULL,
    supabase_storage_path   TEXT NOT NULL,
    file_size_bytes         BIGINT,
    uploaded_by             TEXT,
    uploaded_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pay_docs_pay ON payment_documents(payment_id);
-- ═══════════════════════════════════════════════════════════════════════
-- 012. ACCOUNTING (JOURNAL & LEDGER)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS journal_entries (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_date  TIMESTAMPTZ DEFAULT NOW(),
    narration   TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id  UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
    account     TEXT NOT NULL,
    debit       NUMERIC(12,2) DEFAULT 0,
    credit      NUMERIC(12,2) DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_journal ON ledger_entries(journal_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account);
-- ═══════════════════════════════════════════════════════════════════════
-- 013. NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    type            TEXT DEFAULT 'system',
    priority        TEXT DEFAULT 'Normal',
    is_read         BOOLEAN DEFAULT FALSE,
    link            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_notification_priority CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;
-- ═══════════════════════════════════════════════════════════════════════
-- 014. AUDIT LOGS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action              TEXT NOT NULL,
    entity_type         TEXT,
    entity_id           TEXT,
    customer_id         TEXT,
    document_type       TEXT,
    supabase_storage_path TEXT,
    file_name           TEXT,
    performed_by        TEXT,           -- username
    user_id             TEXT,           -- optional reference to users
    ip_address          TEXT,
    user_agent          TEXT,
    details             JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_audit_action CHECK (action IN ('create', 'update', 'delete', 'upload', 'download', 'login', 'logout', 'status_change', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_customer ON audit_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
-- ═══════════════════════════════════════════════════════════════════════
-- 015. ADDITIONAL INDEXES (Performance)
-- ═══════════════════════════════════════════════════════════════════════

-- Most critical indexes have been created alongside their tables.
-- Here we add advanced indexing for performance and fuzzy search.

-- Fuzzy Search Indexes (using pg_trgm)
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin ( (name->>'firstName') gin_trgm_ops );
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm ON customers USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- Date Range Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_date_range ON quotations (document_date, valid_until);
CREATE INDEX IF NOT EXISTS idx_invoices_date_range ON invoices (document_date, due_date);

-- Foreign Key Composite Indexes for common joins
CREATE INDEX IF NOT EXISTS idx_payments_cust_inv ON payments (customer_id, invoice_id);
-- ═══════════════════════════════════════════════════════════════════════
-- 016. AUTO-UPDATE TIMESTAMPS TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════

-- Company Settings
DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON company_settings;
CREATE TRIGGER trg_company_settings_updated_at BEFORE UPDATE ON company_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Company Branches
DROP TRIGGER IF EXISTS trg_company_branches_updated_at ON company_branches;
CREATE TRIGGER trg_company_branches_updated_at BEFORE UPDATE ON company_branches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bank Accounts
DROP TRIGGER IF EXISTS trg_bank_accounts_updated_at ON bank_accounts;
CREATE TRIGGER trg_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Users
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Customers
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Products
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Quotations
DROP TRIGGER IF EXISTS trg_quotations_updated_at ON quotations;
CREATE TRIGGER trg_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Invoices
DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Payments
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Orders
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- AMC
DROP TRIGGER IF EXISTS trg_amc_updated_at ON amc;
CREATE TRIGGER trg_amc_updated_at BEFORE UPDATE ON amc FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Notifications
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ═══════════════════════════════════════════════════════════════════════
-- 017. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════

-- Since this is an ERP accessed via a Node.js backend using the Service Role Key,
-- we explicitly disable RLS on all tables to ensure unrestricted backend access.
-- If customer portal access is needed later, RLS can be re-enabled per table.

ALTER TABLE company_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE document_numbering DISABLE ROW LEVEL SECURITY;
ALTER TABLE default_payment_terms DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE amc DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════
-- 020. SYSTEM DIAGNOSTICS RPC
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_system_diagnostics()
RETURNS JSON AS $$
DECLARE
    result JSON;
    table_count INT;
BEGIN
    SELECT count(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public';
    
    SELECT json_build_object(
        'tables_created', table_count,
        'customer_count', (SELECT count(*) FROM customers),
        'quotation_count', (SELECT count(*) FROM quotations),
        'invoice_count', (SELECT count(*) FROM invoices),
        'order_count', (SELECT count(*) FROM orders),
        'payment_count', (SELECT count(*) FROM payments)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_system_diagnostics()
RETURNS JSON AS $$
DECLARE
    result JSON;
    table_count INT;
BEGIN
    SELECT count(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public';
    
    SELECT json_build_object(
        'server_time', NOW(),
        'tables_created', table_count,
        'customer_count', (SELECT count(*) FROM customers),
        'quotation_count', (SELECT count(*) FROM quotations),
        'invoice_count', (SELECT count(*) FROM invoices),
        'order_count', (SELECT count(*) FROM orders),
        'payment_count', (SELECT count(*) FROM payments)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;
