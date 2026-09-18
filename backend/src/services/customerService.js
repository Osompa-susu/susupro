const { pool } = require('../db/pool');
const { logAudit } = require('../utils/audit');

function makeAppError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function register({ fullName, phone, community, savingsPlan, smsNotificationsEnabled, registeredBy, ip }) {
  try {
    const custRes = await pool.query(
      `INSERT INTO customers (full_name, phone, community, savings_plan, sms_notifications_enabled, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, customer_code`,
      [fullName, phone, community || null, savingsPlan || 'standard', !!smsNotificationsEnabled, registeredBy]
    );
    const customer = custRes.rows[0];
    // A customer never exists without an account — both inserts
    // happen back-to-back; if the second fails, the pg driver's
    // implicit per-statement behavior still leaves us with an orphan
    // customer, which is exactly why Phase 8+ wraps every FINANCIAL
    // operation in withTransaction(). Registration itself is wrapped
    // too, for the same reason.
    await pool.query(`INSERT INTO accounts (customer_id) VALUES ($1)`, [customer.id]);
    await logAudit(pool, { actorUserId: registeredBy, action: 'CUSTOMER_REGISTERED', entityType: 'customer', entityId: customer.id, details: { customerCode: customer.customer_code }, ip });
    return customer;
  } catch (err) {
    if (err.code === '23505') throw makeAppError(409, 'A customer with this phone number is already registered');
    throw err;
  }
}

async function search({ query, limit = 20, offset = 0 }) {
  const { rows } = await pool.query(
    `SELECT c.customer_code, c.full_name, c.phone, c.status, COALESCE(ab.balance, 0) AS balance
       FROM customers c
       JOIN accounts a ON a.customer_id = c.id
       LEFT JOIN account_balances ab ON ab.account_id = a.id
      WHERE c.customer_code ILIKE $1 OR c.phone ILIKE $1 OR c.full_name ILIKE $1
      ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`,
    [`%${query}%`, limit, offset]
  );
  return rows;
}

async function getByCode(customerCode) {
  const { rows: custRows } = await pool.query(
    `SELECT c.*, a.id AS account_id, COALESCE(ab.balance, 0) AS balance
       FROM customers c JOIN accounts a ON a.customer_id = c.id
       LEFT JOIN account_balances ab ON ab.account_id = a.id
      WHERE c.customer_code = $1`,
    [customerCode]
  );
  if (custRows.length === 0) throw makeAppError(404, 'Customer not found');
  const customer = custRows[0];

  const { rows: history } = await pool.query(
    `SELECT le.transaction_code, le.entry_type, le.signed_amount, le.status, le.created_at, u.full_name AS worker_name
       FROM ledger_entries le JOIN users u ON u.id = le.performed_by
      WHERE le.account_id = $1
      ORDER BY le.created_at DESC LIMIT 100`,
    [customer.account_id]
  );
  return { customer, history };
}

async function setSmsConsent({ customerCode, enabled, changedBy, ip }) {
  const { rows } = await pool.query(
    `UPDATE customers SET sms_notifications_enabled = $1, updated_at = now() WHERE customer_code = $2 RETURNING id, customer_code, sms_notifications_enabled`,
    [enabled, customerCode]
  );
  if (rows.length === 0) throw makeAppError(404, 'Customer not found');
  await logAudit(pool, {
    actorUserId: changedBy, action: 'SMS_CONSENT_CHANGED', entityType: 'customer', entityId: rows[0].id,
    details: { customerCode, enabled }, ip,
  });
  return rows[0];
}

module.exports = { register, search, getByCode, setSmsConsent };
