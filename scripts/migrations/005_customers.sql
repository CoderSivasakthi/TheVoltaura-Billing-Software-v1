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
