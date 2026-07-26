-- ═══════════════════════════════════════════════════════════════════════
-- 002. SEQUENCES
-- ═══════════════════════════════════════════════════════════════════════

-- Ensure all sequences are created before the tables that reference them.

CREATE SEQUENCE IF NOT EXISTS users_seq START 1;
CREATE SEQUENCE IF NOT EXISTS customers_seq START 1;
CREATE SEQUENCE IF NOT EXISTS products_seq START 1;
CREATE SEQUENCE IF NOT EXISTS quotations_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoices_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payments_seq START 1;
CREATE SEQUENCE IF NOT EXISTS orders_seq START 1;
