/* Real integration tests — require a disposable PostgreSQL test
   database with database/migrations/*.sql applied, reachable via
   TEST_DATABASE_URL. Cannot run in a network/DB-isolated sandbox;
   run in CI or locally, e.g.:

     createdb susupro_test
     for f in database/migrations/*.sql; do psql susupro_test -f $f; done
     TEST_DATABASE_URL=postgres://localhost/susupro_test JWT_SECRET=test npm test
*/
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to a disposable test database with database/migrations applied.');
}

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

async function truncateAll() {
  await pool.query(`
    TRUNCATE audit_logs, security_events, approvals, withdrawal_requests,
             ledger_entries, accounts, customers, sessions, devices, users RESTART IDENTITY CASCADE
  `);
}

async function seedUser({ phone, password = 'CorrectHorse123!', role = 'worker', status = 'active', staffCode }) {
  const hash = await bcrypt.hash(password, 4); // low cost factor in tests only
  const roleRow = await pool.query(`SELECT id FROM roles WHERE name = $1`, [role]);
  const { rows } = await pool.query(
    `INSERT INTO users (staff_code, full_name, phone, password_hash, role_id, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [staffCode || `${role === 'admin' ? 'A' : 'W'}-${Math.floor(Math.random() * 9000 + 1000)}`, 'Test User', phone, hash, roleRow.rows[0].id, status]
  );
  return { id: rows[0].id, phone, password, role };
}

module.exports = { pool, truncateAll, seedUser };
