-- ═══════════════════════════════════════════════════════════════════════
-- 006. PRODUCTS
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY DEFAULT 'PROD-' || LPAD(nextval('products_seq')::text, 6, '0'),
    name        TEXT NOT NULL,
    description TEXT,
    category    TEXT, 
    sku         TEXT UNIQUE,
    hsn_code    TEXT,
    price       NUMERIC(12,2) DEFAULT 0,
    gst_rate    NUMERIC(5,2) DEFAULT 18,
    stock       INTEGER DEFAULT 0,
    min_stock   INTEGER DEFAULT 5,
    unit        TEXT DEFAULT 'Nos',
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_product_category CHECK (category IN ('Panels', 'Inverter', 'Battery', 'Cables', 'Accessories', 'Other'))
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
