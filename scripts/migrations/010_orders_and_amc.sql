-- ═══════════════════════════════════════════════════════════════════════
-- 010. ORDERS & AMC
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Orders Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY DEFAULT 'ORD-' || LPAD(nextval('orders_seq')::text, 6, '0'),
    quotation_id    TEXT REFERENCES quotations(id) ON DELETE RESTRICT,
    customer_id     TEXT REFERENCES customers(id) ON DELETE RESTRICT,
    priority        TEXT DEFAULT 'Normal',
    order_status    TEXT DEFAULT 'Pending',
    assigned_to     TEXT,
    target_date     DATE,
    completed_date  DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_order_priority CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
    CONSTRAINT chk_order_status CHECK (order_status IN ('Pending', 'In Progress', 'Completed', 'Cancelled', 'On Hold'))
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_quotation ON orders(quotation_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);

-- ── 2. AMC Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amc (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     TEXT REFERENCES customers(id) ON DELETE CASCADE,
    quotation_id    TEXT REFERENCES quotations(id) ON DELETE SET NULL,
    start_date      DATE,
    end_date        DATE,
    amount          NUMERIC(12,2),
    status          TEXT DEFAULT 'Active',
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_amc_status CHECK (status IN ('Active', 'Expired', 'Cancelled', 'Pending Renewal'))
);

CREATE INDEX IF NOT EXISTS idx_amc_customer ON amc(customer_id);
CREATE INDEX IF NOT EXISTS idx_amc_status ON amc(status);
