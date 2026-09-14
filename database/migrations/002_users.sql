-- Migration 002: Users
-- Includes force_password_change and mfa fields from the start (the
-- prior project added these as a mid-project fix; building them in
-- now avoids that same gap here).

CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_code              TEXT NOT NULL UNIQUE,
    full_name               TEXT NOT NULL,
    phone                   TEXT NOT NULL UNIQUE,
    password_hash           TEXT NOT NULL,
    role_id                 SMALLINT NOT NULL REFERENCES roles(id),
    status                  TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'suspended', 'deactivated')),
    failed_login_count      SMALLINT NOT NULL DEFAULT 0,
    locked_until            TIMESTAMPTZ,
    force_password_change   BOOLEAN NOT NULL DEFAULT false,
    mfa_secret              TEXT,
    mfa_enabled             BOOLEAN NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role ON users(role_id);

CREATE SEQUENCE worker_code_seq START 1;
CREATE SEQUENCE admin_code_seq START 1;
-- Two separate sequences (not one shared one) so staff codes stay
-- meaningfully prefixed (W-001, A-001) without needing a trigger to
-- branch on role — the application chooses which sequence to pull
-- from at insert time based on the role being created.
