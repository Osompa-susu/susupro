-- Migration 007: Sessions & Devices
-- Sessions are revocable server-side (a bearer JWT alone can't be
-- "logged out" — the session row backing it can). Devices are modeled
-- separately from users from the start, per docs/roles-and-permissions.md's
-- note that device-level control is a second axis alongside user roles —
-- built now so Phase 16 (PWA/tablet support) doesn't need a schema change.

CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_code     TEXT NOT NULL UNIQUE, -- e.g. TAB-001, assigned by admin
    label           TEXT,                  -- e.g. "Kofi's tablet"
    assigned_to     UUID REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'deactivated')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_assigned_to ON devices(assigned_to);

CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    device_id       UUID REFERENCES devices(id), -- null for a browser session not tied to a registered device
    token_hash      TEXT NOT NULL UNIQUE,
    ip_address      INET,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_device ON sessions(device_id);
-- Retention: a scheduled job should hard-delete rows where
-- expires_at < now() - interval '90 days' (Phase 14/15 operational
-- concern, not a constraint enforced here).
