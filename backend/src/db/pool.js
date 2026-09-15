// Phase 6+: every route that touches the database goes through this
// module. Every query MUST use $1/$2/... parameterized placeholders —
// string-built SQL is never acceptable (see docs/security-requirements.md).
const { Pool } = require('pg');
const env = require('../config/env');

// Render (and most managed Postgres providers) require SSL for
// connections, but reject the default strict certificate validation
// since they use an internally-issued cert. Only applied in
// production — local development Postgres has no SSL requirement.
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});

async function withTransaction(fn, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '40001' && attempt < retries) {
        await new Promise((r) => setTimeout(r, 25 * attempt));
        continue;
      }
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = { pool, withTransaction };