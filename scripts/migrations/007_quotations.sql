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
