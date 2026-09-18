ALTER TABLE customers ADD COLUMN sms_notifications_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE ledger_entries DROP CONSTRAINT ledger_entries_entry_type_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_entry_type_check
    CHECK (entry_type IN ('deposit', 'withdrawal', 'correction', 'fee'));

CREATE TABLE sms_notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES customers(id),
    ledger_entry_id     UUID REFERENCES ledger_entries(id),
    fee_entry_id        UUID REFERENCES ledger_entries(id),
    phone               TEXT NOT NULL,
    message             TEXT NOT NULL,
    status              TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped_not_configured', 'skipped_low_balance', 'skipped_insufficient_balance')),
    provider_response    JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_notifications_customer ON sms_notifications(customer_id, created_at DESC);