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
