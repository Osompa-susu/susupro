-- Fictional demo data ONLY. Never run against a database containing
-- or intended to contain real customer information.
-- Passwords below are bcrypt hashes of "Demo1234!Change" — change
-- immediately in any environment beyond local development.

INSERT INTO users (staff_code, full_name, phone, password_hash, role_id, status)
VALUES
    ('A-001', 'Demo Admin', '0240000001', '$2b$12$replace.with.a.real.bcrypt.hash.before.use', (SELECT id FROM roles WHERE name='admin'), 'active'),
    ('W-001', 'Kofi Mensah', '0240000002', '$2b$12$replace.with.a.real.bcrypt.hash.before.use', (SELECT id FROM roles WHERE name='worker'), 'active'),
    ('W-002', 'Adwoa Asante', '0240000003', '$2b$12$replace.with.a.real.bcrypt.hash.before.use', (SELECT id FROM roles WHERE name='worker'), 'active');

INSERT INTO customers (full_name, phone, community, savings_plan, registered_by)
SELECT v.full_name, v.phone, v.community, v.savings_plan, (SELECT id FROM users WHERE staff_code = 'W-001')
FROM (VALUES
    ('Ama Mensah', '0240001111', 'Madina', 'standard'),
    ('Kwame Asare', '0240002222', 'Adenta', 'standard'),
    ('Akosua Boateng', '0240003333', 'Madina', 'flexible'),
    ('Kofi Owusu', '0240004444', 'Ashaiman', 'standard')
) AS v(full_name, phone, community, savings_plan);

INSERT INTO accounts (customer_id)
SELECT id FROM customers;

-- NOTE: bcrypt hashes above are placeholders (not valid hashes) —
-- generate real ones with `node -e "console.log(require('bcrypt').hashSync('Demo1234!Change', 12))"`
-- before actually seeding a real database. Left as an obvious
-- placeholder rather than a real hash of a published password, so
-- nobody accidentally treats a checked-in demo hash as a real credential.
