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
