-- ═══════════════════════════════════════════════════════════════════════════
-- TheVoltaura ERP — Multi-Tenant Franchise Schema Migration
-- Script: 02_franchise_multitenant_schema.sql
-- Run this ONCE in Supabase SQL Editor to add franchise multi-tenancy.
-- Safe to run on existing data — uses IF NOT EXISTS and ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions (if not already present) ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1 — NEW CORE TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Franchises — Master registry of all franchise accounts
CREATE TABLE IF NOT EXISTS franchises (
    id                  TEXT PRIMARY KEY,                        -- TVA-FR-0001
    franchise_code      TEXT UNIQUE NOT NULL,                    -- TVA-FR-0001
    name                TEXT NOT NULL,                           -- Erode Franchise
    city                TEXT,
    state               TEXT,
    admin_name          TEXT,
    admin_email         TEXT UNIQUE,
    admin_phone         TEXT,
    branch_address      TEXT,
    local_office_address TEXT,
    contact_number      TEXT,
    working_hours       TEXT,
    bank_account_name   TEXT,
    bank_account_number TEXT,
    bank_ifsc           TEXT,
    bank_name           TEXT,
    bank_account_permitted BOOLEAN DEFAULT FALSE,                -- Super Admin grants bank edit access
    status              TEXT NOT NULL DEFAULT 'Active'
                            CHECK (status IN ('Active', 'Suspended', 'Inactive')),
    logo_url            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          TEXT                                     -- super_admin username
);

-- 2. Roles — Role definitions
CREATE TABLE IF NOT EXISTS roles (
    id          TEXT PRIMARY KEY,                                 -- super_admin, franchise_admin, franchise_staff
    label       TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (id, label, description) VALUES
    ('super_admin',      'Super Admin',      'TheVoltaura Head Office — full unrestricted access'),
    ('franchise_admin',  'Franchise Admin',  'Franchise administrator — own data only'),
    ('franchise_staff',  'Franchise Staff',  'Franchise staff — limited access inherited from admin')
ON CONFLICT (id) DO NOTHING;

-- 3. Permissions — RBAC permission matrix
CREATE TABLE IF NOT EXISTS permissions (
    id              SERIAL PRIMARY KEY,
    role_id         TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    resource        TEXT NOT NULL,   -- customers, quotations, invoices, settings, approvals, franchises
    can_view        BOOLEAN DEFAULT FALSE,
    can_create      BOOLEAN DEFAULT FALSE,
    can_edit        BOOLEAN DEFAULT FALSE,
    can_delete      BOOLEAN DEFAULT FALSE,
    can_approve     BOOLEAN DEFAULT FALSE,
    notes           TEXT,
    UNIQUE (role_id, resource)
);

-- Super Admin: full access on everything
INSERT INTO permissions (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve) VALUES
    ('super_admin', 'customers',    TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'quotations',   TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'invoices',     TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'payments',     TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'orders',       TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'products',     TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'amc',          TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'reports',      TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'settings',     TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'franchises',   TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'approvals',    TRUE, TRUE, TRUE, TRUE, TRUE),
    ('super_admin', 'branding',     TRUE, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (role_id, resource) DO NOTHING;

-- Franchise Admin: own data, cannot approve, cannot touch branding/company settings
INSERT INTO permissions (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve) VALUES
    ('franchise_admin', 'customers',    TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
    ('franchise_admin', 'quotations',   TRUE,  TRUE,  TRUE,  FALSE, FALSE),
    ('franchise_admin', 'invoices',     TRUE,  TRUE,  TRUE,  FALSE, FALSE),
    ('franchise_admin', 'payments',     TRUE,  TRUE,  TRUE,  FALSE, FALSE),
    ('franchise_admin', 'orders',       TRUE,  TRUE,  TRUE,  FALSE, FALSE),
    ('franchise_admin', 'products',     TRUE,  FALSE, FALSE, FALSE, FALSE),
    ('franchise_admin', 'amc',          TRUE,  TRUE,  TRUE,  FALSE, FALSE),
    ('franchise_admin', 'reports',      TRUE,  FALSE, FALSE, FALSE, FALSE),
    ('franchise_admin', 'settings',     TRUE,  FALSE, TRUE,  FALSE, FALSE),  -- limited edit only
    ('franchise_admin', 'franchises',   FALSE, FALSE, FALSE, FALSE, FALSE),
    ('franchise_admin', 'approvals',    FALSE, FALSE, FALSE, FALSE, FALSE),
    ('franchise_admin', 'branding',     FALSE, FALSE, FALSE, FALSE, FALSE)  -- locked
ON CONFLICT (role_id, resource) DO NOTHING;

-- Franchise Staff: read-mostly
INSERT INTO permissions (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve) VALUES
    ('franchise_staff', 'customers',    TRUE,  TRUE,  FALSE, FALSE, FALSE),
    ('franchise_staff', 'quotations',   TRUE,  TRUE,  FALSE, FALSE, FALSE),
    ('franchise_staff', 'invoices',     TRUE,  FALSE, FALSE, FALSE, FALSE),
    ('franchise_staff', 'payments',     TRUE,  FALSE, FALSE, FALSE, FALSE),
    ('franchise_staff', 'orders',       TRUE,  FALSE, FALSE, FALSE, FALSE),
    ('franchise_staff', 'products',     TRUE,  FALSE, FALSE, FALSE, FALSE),
    ('franchise_staff', 'amc',          TRUE,  FALSE, FALSE, FALSE, FALSE),
    ('franchise_staff', 'reports',      TRUE,  FALSE, FALSE, FALSE, FALSE),
    ('franchise_staff', 'settings',     FALSE, FALSE, FALSE, FALSE, FALSE),
    ('franchise_staff', 'franchises',   FALSE, FALSE, FALSE, FALSE, FALSE),
    ('franchise_staff', 'approvals',    FALSE, FALSE, FALSE, FALSE, FALSE),
    ('franchise_staff', 'branding',     FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role_id, resource) DO NOTHING;

-- 4. Tenant Settings — Franchise-specific overrideable settings only
CREATE TABLE IF NOT EXISTS tenant_settings (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    franchise_id            TEXT NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
    branch_address          TEXT,
    local_office_address    TEXT,
    contact_number          TEXT,
    email                   TEXT,
    bank_account_name       TEXT,
    bank_account_number     TEXT,
    bank_ifsc               TEXT,
    bank_name               TEXT,
    working_hours           TEXT,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by              TEXT,
    UNIQUE (franchise_id)
);

-- 5. Approval Logs — Immutable history of all approval actions
CREATE TABLE IF NOT EXISTS approval_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('quotation', 'invoice')),
    entity_id       TEXT NOT NULL,
    franchise_id    TEXT REFERENCES franchises(id) ON DELETE SET NULL,
    tenant_id       TEXT,
    action          TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'revision_requested')),
    performed_by    TEXT NOT NULL,    -- username of actor
    performed_role  TEXT NOT NULL,    -- role of actor
    comment         TEXT,             -- rejection reason or revision instructions
    old_status      TEXT,
    new_status      TEXT,
    ip_address      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2 — ADD MULTI-TENANT COLUMNS TO EXISTING TABLES
-- Uses ADD COLUMN IF NOT EXISTS (safe on existing data)
-- ═══════════════════════════════════════════════════════════════════════════

-- Users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS franchise_id   TEXT REFERENCES franchises(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMPTZ;

-- Update existing admin user to super_admin role
UPDATE users SET role = 'super_admin' WHERE username = 'admin' AND role IN ('admin', 'Admin');

-- Customers table
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS tenant_id      TEXT NOT NULL DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS franchise_id   TEXT REFERENCES franchises(id) ON DELETE SET NULL;

-- Quotations table
ALTER TABLE quotations
    ADD COLUMN IF NOT EXISTS tenant_id          TEXT NOT NULL DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS franchise_id       TEXT REFERENCES franchises(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approval_status    TEXT NOT NULL DEFAULT 'Draft'
                                                    CHECK (approval_status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Revision Requested')),
    ADD COLUMN IF NOT EXISTS approved_by        TEXT,
    ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason   TEXT,
    ADD COLUMN IF NOT EXISTS submitted_at       TIMESTAMPTZ;

-- Invoices table
ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS tenant_id          TEXT NOT NULL DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS franchise_id       TEXT REFERENCES franchises(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approval_status    TEXT NOT NULL DEFAULT 'Draft'
                                                    CHECK (approval_status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Revision Requested')),
    ADD COLUMN IF NOT EXISTS approved_by        TEXT,
    ADD COLUMN IF NOT EXISTS approved_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason   TEXT,
    ADD COLUMN IF NOT EXISTS submitted_at       TIMESTAMPTZ;

-- Payments table
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS tenant_id      TEXT NOT NULL DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS franchise_id   TEXT REFERENCES franchises(id) ON DELETE SET NULL;

-- Orders table (already has tenant_id — just add franchise_id)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS franchise_id   TEXT REFERENCES franchises(id) ON DELETE SET NULL;

-- AMC table
ALTER TABLE amc
    ADD COLUMN IF NOT EXISTS tenant_id      TEXT NOT NULL DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS franchise_id   TEXT REFERENCES franchises(id) ON DELETE SET NULL;

-- Notifications table
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS tenant_id      TEXT,
    ADD COLUMN IF NOT EXISTS franchise_id   TEXT REFERENCES franchises(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS target_role    TEXT;

-- Audit logs table
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS franchise_id   TEXT REFERENCES franchises(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3 — INDEXES FOR MULTI-TENANT QUERY PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_customers_tenant    ON customers    (tenant_id, franchise_id);
CREATE INDEX IF NOT EXISTS idx_quotations_tenant   ON quotations   (tenant_id, franchise_id);
CREATE INDEX IF NOT EXISTS idx_quotations_approval ON quotations   (approval_status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant     ON invoices     (tenant_id, franchise_id);
CREATE INDEX IF NOT EXISTS idx_invoices_approval   ON invoices     (approval_status);
CREATE INDEX IF NOT EXISTS idx_payments_tenant     ON payments     (tenant_id, franchise_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant       ON orders       (tenant_id, franchise_id);
CREATE INDEX IF NOT EXISTS idx_amc_tenant          ON amc          (tenant_id, franchise_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications (tenant_id, franchise_id);
CREATE INDEX IF NOT EXISTS idx_approval_logs_entity ON approval_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_logs_franchise ON approval_logs (franchise_id);
CREATE INDEX IF NOT EXISTS idx_franchises_status   ON franchises   (status);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4 — AUTO-UPDATE TRIGGERS FOR NEW TABLES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE TRIGGER trg_franchises_updated_at
    BEFORE UPDATE ON franchises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_tenant_settings_updated_at
    BEFORE UPDATE ON tenant_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5 — FRANCHISE ID SEQUENCE & HELPER FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE SEQUENCE IF NOT EXISTS franchises_seq START 1;

CREATE OR REPLACE FUNCTION generate_franchise_id()
RETURNS TEXT AS $$
DECLARE
    next_val INT;
BEGIN
    SELECT nextval('franchises_seq') INTO next_val;
    RETURN 'TVA-FR-' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 6 — SUPER ADMIN DASHBOARD VIEW
-- Aggregates revenue + stats per franchise — used by /api/super-admin/dashboard
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW franchise_dashboard_summary AS
SELECT
    f.id                                                        AS franchise_id,
    f.franchise_code,
    f.name                                                      AS franchise_name,
    f.city,
    f.status,
    COUNT(DISTINCT c.id)                                        AS total_customers,
    COUNT(DISTINCT q.id)                                        AS total_quotations,
    COUNT(DISTINCT q.id) FILTER (WHERE q.approval_status = 'Submitted') AS pending_quotation_approvals,
    COUNT(DISTINCT i.id)                                        AS total_invoices,
    COUNT(DISTINCT i.id) FILTER (WHERE i.approval_status = 'Submitted') AS pending_invoice_approvals,
    COALESCE(SUM(i.grand_total) FILTER (WHERE i.status = 'Paid'), 0) AS total_revenue,
    COALESCE(SUM(i.grand_total) FILTER (WHERE i.status IN ('Pending','Partially Paid','Overdue')), 0) AS outstanding,
    f.created_at
FROM franchises f
LEFT JOIN customers   c ON c.franchise_id = f.id
LEFT JOIN quotations  q ON q.franchise_id = f.id
LEFT JOIN invoices    i ON i.franchise_id = f.id
GROUP BY f.id, f.franchise_code, f.name, f.city, f.status, f.created_at;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this script in Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════
