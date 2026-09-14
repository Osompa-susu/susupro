-- Migration 005: Withdrawal Requests & Approvals
-- No specific limits/thresholds are encoded here — per
-- docs/unresolved-questions.md item 3, the master prompt explicitly
-- forbids inventing them. The schema supports a two-step
-- request-then-approve flow structurally; whether every withdrawal
-- needs approval, or only some, is an application-layer/business-rule
-- decision to be confirmed later, not a database constraint here.

CREATE TABLE withdrawal_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES accounts(id),
    amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    requested_by    UUID NOT NULL REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
    ledger_entry_id UUID REFERENCES ledger_entries(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_withdrawal_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_account ON withdrawal_requests(account_id);

CREATE TABLE approvals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_request_id   UUID NOT NULL REFERENCES withdrawal_requests(id),
    decided_by              UUID NOT NULL REFERENCES users(id),
    decision                TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
    decided_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason                  TEXT
);
CREATE INDEX idx_approvals_request ON approvals(withdrawal_request_id);
