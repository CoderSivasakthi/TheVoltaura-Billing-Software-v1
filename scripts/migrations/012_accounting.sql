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
