-- Migration 006: Audit Logs & Security Events
-- Two separate tables: audit_logs is "what a user did" (business
-- actions); security_events is "what the system noticed" (failed
-- logins, blocked trigger exceptions, rate-limit trips). Both
-- append-only, enforced at the database layer, not just by omitting
-- a mutating route.

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   UUID REFERENCES users(id),
    action          TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       UUID,
    details         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE security_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      TEXT NOT NULL,
    user_id         UUID REFERENCES users(id),
    ip_address      INET,
    details         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);

CREATE OR REPLACE FUNCTION prevent_append_only_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();
CREATE TRIGGER trg_security_events_no_update BEFORE UPDATE ON security_events
    FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();
CREATE TRIGGER trg_security_events_no_delete BEFORE DELETE ON security_events
    FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();
