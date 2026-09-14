-- Migration 004: Ledger Entries
-- This is the single source of truth for money. No balance column
-- exists anywhere in this schema — it is always SUM(signed_amount).
--
-- Built correctly from the start (lessons carried forward as design
-- decisions, not copied code, from the prior project):
--   - transaction_code from a SEQUENCE, not COUNT(*)+1
--   - idempotency_key UNIQUE, so duplicate submissions are rejected
--     at the database level, not just hoped to be caught in app code
--   - the negative-balance trigger checks ANY completed entry with a
--     negative signed_amount (withdrawal OR a negative correction),
--     not just entry_type='withdrawal' — the prior project shipped
--     the narrower version first and had to fix it after finding a
--     real gap; starting with the correct version here.

CREATE SEQUENCE transaction_code_seq START 1;

CREATE TABLE ledger_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_code    TEXT NOT NULL UNIQUE
                            DEFAULT ('TXN-' || to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('transaction_code_seq')::text, 8, '0')),
    account_id          UUID NOT NULL REFERENCES accounts(id),
    entry_type          TEXT NOT NULL
                            CHECK (entry_type IN ('deposit', 'withdrawal', 'correction')),
    signed_amount       NUMERIC(14,2) NOT NULL CHECK (signed_amount <> 0),
    performed_by        UUID NOT NULL REFERENCES users(id),
    reverses_entry_id   UUID REFERENCES ledger_entries(id),
    status              TEXT NOT NULL DEFAULT 'completed'
                            CHECK (status IN ('completed', 'pending_approval', 'rejected')),
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    idempotency_key     TEXT UNIQUE,
    note                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_account ON ledger_entries(account_id);
CREATE INDEX idx_ledger_performed_by ON ledger_entries(performed_by);
CREATE INDEX idx_ledger_created_at ON ledger_entries(created_at);

CREATE OR REPLACE FUNCTION prevent_ledger_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ledger_entries rows are immutable once completed; insert a correction row instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_no_update BEFORE UPDATE ON ledger_entries
    FOR EACH ROW WHEN (OLD.status = 'completed') EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER trg_ledger_no_delete BEFORE DELETE ON ledger_entries
    FOR EACH ROW WHEN (OLD.status = 'completed') EXECUTE FUNCTION prevent_ledger_mutation();

CREATE VIEW account_balances AS
SELECT account_id, COALESCE(SUM(signed_amount), 0)::NUMERIC(14,2) AS balance
FROM ledger_entries
WHERE status = 'completed'
GROUP BY account_id;

CREATE OR REPLACE FUNCTION check_sufficient_balance() RETURNS TRIGGER AS $$
DECLARE
    current_balance NUMERIC(14,2);
BEGIN
    -- Fires for ANY negative completed entry (withdrawal or a
    -- negative correction) — see the migration header comment.
    IF NEW.signed_amount < 0 AND NEW.status = 'completed' THEN
        SELECT COALESCE(SUM(signed_amount), 0) INTO current_balance
        FROM ledger_entries WHERE account_id = NEW.account_id AND status = 'completed';
        IF current_balance + NEW.signed_amount < 0 THEN
            RAISE EXCEPTION 'Insufficient balance: % + % would go negative', current_balance, NEW.signed_amount;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_balance BEFORE INSERT ON ledger_entries
    FOR EACH ROW EXECUTE FUNCTION check_sufficient_balance();
