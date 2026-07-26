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
