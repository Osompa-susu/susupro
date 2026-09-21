-- Migration 011: Monthly susu collection fee
--
-- Confirmed with the business owner (via Patrick, 2026-09-21): GHS 10
-- is charged once for any calendar month a customer's account has at
-- least one completed deposit, evaluated at month-end (not on the
-- deposit itself). If charging it would take the balance below the
-- GHS 50 minimum, it is held as owed and combined with a later month
-- once the balance allows it — nothing is ever silently forgiven, and
-- nothing is ever charged that would breach the floor. See
-- backend/src/services/monthlyFeeService.js for the actual logic.

CREATE TABLE monthly_fees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES accounts(id),
    fee_month       DATE NOT NULL, -- first day of the month this GHS 10 covers
    amount          NUMERIC(14,2) NOT NULL DEFAULT 10.00,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'charged')),
    ledger_entry_id UUID REFERENCES ledger_entries(id),
    charged_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, fee_month)
);
CREATE INDEX idx_monthly_fees_pending ON monthly_fees(account_id) WHERE status = 'pending';

-- A dedicated, non-loginable system user so automated fee entries have
-- a real, non-null performed_by (ledger_entries requires one — see
-- migration 004). status='suspended' blocks login outright, on top of
-- the password_hash below not being a hash of any real password.
-- monthlyFeeService.js also re-creates this row on demand if it's
-- ever missing (e.g. in a freshly truncated test database), so this
-- insert is a convenience for production, not a hard dependency.
INSERT INTO users (staff_code, full_name, phone, password_hash, role_id, status, force_password_change)
VALUES (
    'SYS-001',
    'SusuPro Automated Billing',
    '000-000-0000-SYS',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- placeholder hash; this account can never log in
    (SELECT id FROM roles WHERE name = 'admin'),
    'suspended',
    false
)
ON CONFLICT (staff_code) DO NOTHING;
