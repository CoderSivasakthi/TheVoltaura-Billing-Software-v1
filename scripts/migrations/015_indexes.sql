-- ═══════════════════════════════════════════════════════════════════════
-- 015. ADDITIONAL INDEXES (Performance)
-- ═══════════════════════════════════════════════════════════════════════

-- Most critical indexes have been created alongside their tables.
-- Here we add advanced indexing for performance and fuzzy search.

-- Fuzzy Search Indexes (using pg_trgm)
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin ( (name->>'firstName') gin_trgm_ops );
CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm ON customers USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- Date Range Indexes
CREATE INDEX IF NOT EXISTS idx_quotations_date_range ON quotations (document_date, valid_until);
CREATE INDEX IF NOT EXISTS idx_invoices_date_range ON invoices (document_date, due_date);

-- Foreign Key Composite Indexes for common joins
CREATE INDEX IF NOT EXISTS idx_payments_cust_inv ON payments (customer_id, invoice_id);
