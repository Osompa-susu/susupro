-- Migration 003: Customers & Accounts
-- customer_code from a SEQUENCE (atomic under concurrency), not
-- COUNT(*)+1 — learned the hard way on the prior project, built
-- correctly from the start here.

CREATE SEQUENCE customer_code_seq START 1;

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code   TEXT NOT NULL UNIQUE
                        DEFAULT ('SUS-' || lpad(nextval('customer_code_seq')::text, 6, '0')),
    full_name       TEXT NOT NULL,
    phone           TEXT NOT NULL,
    community       TEXT,
    savings_plan    TEXT NOT NULL DEFAULT 'standard',
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'closed')),
    registered_by   UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name_trgm ON customers USING gin (full_name gin_trgm_ops);

CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL UNIQUE REFERENCES customers(id),
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'frozen', 'closed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
