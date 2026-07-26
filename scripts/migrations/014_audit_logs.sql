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
