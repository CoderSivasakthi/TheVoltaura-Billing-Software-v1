-- ═══════════════════════════════════════════════════════════════════════
-- 001. EXTENSIONS & GENERIC FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy search

-- ── Generic Functions ───────────────────────────────────────────────────

-- 1. Auto-Update Timestamp Function
-- Used by triggers to automatically update the updated_at column on UPDATE.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Generate Customer Code Function
-- Generates CUST-000001 format codes automatically.
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
DECLARE
    next_val INT;
BEGIN
    -- If customer_code is not provided, generate one
    IF NEW.customer_code IS NULL THEN
        -- Safely get next value from the sequence
        SELECT nextval('customers_seq') INTO next_val;
        NEW.customer_code := 'CUST-' || LPAD(next_val::TEXT, 6, '0');
    END IF;
    
    -- If id is not provided, make it equal to customer_code
    IF NEW.id IS NULL THEN
        NEW.id := NEW.customer_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
