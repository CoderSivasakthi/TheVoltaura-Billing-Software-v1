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
