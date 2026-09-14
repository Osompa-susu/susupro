-- Migration 001: Roles & Permissions
-- Granular RBAC from day one (roles + permissions + join table), not a
-- flat role string, per docs/roles-and-permissions.md's note that the
-- master prompt's own entity list anticipates this.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE roles (
    id      SMALLSERIAL PRIMARY KEY,
    name    TEXT NOT NULL UNIQUE CHECK (name = lower(name))
);

CREATE TABLE permissions (
    id      SMALLSERIAL PRIMARY KEY,
    code    TEXT NOT NULL UNIQUE
);

CREATE TABLE role_permissions (
    role_id       SMALLINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id SMALLINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

INSERT INTO roles (name) VALUES ('admin'), ('worker');

INSERT INTO permissions (code) VALUES
    ('customer.register'), ('customer.view'), ('customer.search'), ('customer.update'),
    ('deposit.create'),
    ('withdrawal.request'), ('withdrawal.approve'),
    ('transaction.correct'),
    ('worker.manage'),
    ('audit.view'), ('report.view'), ('security.view'),
    ('device.manage');

INSERT INTO role_permissions (role_id, permission_id)
    SELECT (SELECT id FROM roles WHERE name='admin'), id FROM permissions;
INSERT INTO role_permissions (role_id, permission_id)
    SELECT (SELECT id FROM roles WHERE name='worker'), id FROM permissions
    WHERE code IN ('customer.register','customer.view','customer.search','deposit.create','withdrawal.request');
-- NOTE: worker registration/withdrawal permission is a placeholder
-- default per docs/unresolved-questions.md items 1–2 — NOT a confirmed
-- business rule. Revisit once the owner answers.
