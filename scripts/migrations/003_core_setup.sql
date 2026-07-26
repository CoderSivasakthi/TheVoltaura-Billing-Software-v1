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
