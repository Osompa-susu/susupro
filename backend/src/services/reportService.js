const { pool } = require('../db/pool');

function makeAppError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function dashboard() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [{ rows: totals }, { rows: today }, { rows: workers }, { rows: pending }, { rows: recent }, { rows: totalSavingsRows }] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total_customers FROM customers`),
    pool.query(
      `SELECT COALESCE(SUM(signed_amount) FILTER (WHERE entry_type = 'deposit'), 0) AS todays_deposits,
              COALESCE(-SUM(signed_amount) FILTER (WHERE entry_type = 'withdrawal'), 0) AS todays_withdrawals
         FROM ledger_entries WHERE status = 'completed' AND created_at::date = $1::date`,
      [todayStr]
    ),
    pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE role_id = (SELECT id FROM roles WHERE name='worker') AND status = 'active'`),
    pool.query(`SELECT COUNT(*)::int AS n FROM withdrawal_requests WHERE status = 'pending'`),
    pool.query(
      `SELECT le.transaction_code, le.entry_type, le.signed_amount, le.created_at, c.full_name AS customer_name, u.full_name AS worker_name
         FROM ledger_entries le JOIN accounts a ON a.id = le.account_id JOIN customers c ON c.id = a.customer_id JOIN users u ON u.id = le.performed_by
        ORDER BY le.created_at DESC LIMIT 8`
    ),
    pool.query(`SELECT COALESCE(SUM(balance), 0) AS total FROM account_balances`),
  ]);

  return {
    totalCustomers: totals[0].total_customers,
    totalSavings: totalSavingsRows[0].total,
    todaysDeposits: today[0].todays_deposits,
    todaysWithdrawals: today[0].todays_withdrawals,
    activeWorkers: workers[0].n,
    pendingWithdrawals: pending[0].n,
    recentTransactions: recent,
  };
}

async function summary({ from, to }) {
  const fromDate = from || new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const toDate = to || new Date().toISOString();
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(signed_amount) FILTER (WHERE entry_type = 'deposit'), 0) AS deposits,
            COALESCE(-SUM(signed_amount) FILTER (WHERE entry_type = 'withdrawal'), 0) AS withdrawals,
            COALESCE(SUM(signed_amount), 0) AS net, COUNT(*) AS transaction_count
       FROM ledger_entries WHERE status = 'completed' AND created_at BETWEEN $1 AND $2`,
    [fromDate, toDate]
  );
  const { rows: activeWorkers } = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE role_id = (SELECT id FROM roles WHERE name='worker') AND status = 'active'`);
  return { from: fromDate, to: toDate, ...rows[0], activeWorkers: activeWorkers[0].n };
}

async function byWorker({ from, to, workerId }) {
  const clauses = [`le.status = 'completed'`, `le.entry_type = 'deposit'`];
  const params = [];
  if (from) { params.push(from); clauses.push(`le.created_at >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`le.created_at <= $${params.length}`); }
  if (workerId) { params.push(workerId); clauses.push(`le.performed_by = $${params.length}`); }

  const { rows } = await pool.query(
    `SELECT u.id AS worker_id, u.full_name AS worker_name, u.staff_code,
            COALESCE(SUM(le.signed_amount), 0) AS total_collected, COUNT(le.id) AS transaction_count
       FROM users u
       LEFT JOIN ledger_entries le ON le.performed_by = u.id AND ${clauses.join(' AND ')}
      WHERE u.role_id = (SELECT id FROM roles WHERE name='worker')
      GROUP BY u.id, u.full_name, u.staff_code
      ORDER BY total_collected DESC`,
    params
  );
  return rows;
}

async function transactionsReport({ from, to, type, status = 'completed', workerId, limit = 50, offset = 0 }) {
  const clauses = [`le.status = $1`];
  const params = [status];
  if (from) { params.push(from); clauses.push(`le.created_at >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`le.created_at <= $${params.length}`); }
  if (type) { params.push(type); clauses.push(`le.entry_type = $${params.length}`); }
  if (workerId) { params.push(workerId); clauses.push(`le.performed_by = $${params.length}`); }
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT le.transaction_code, le.entry_type, le.signed_amount, le.status, le.created_at,
            c.customer_code, c.full_name AS customer_name, u.full_name AS worker_name
       FROM ledger_entries le JOIN accounts a ON a.id = le.account_id JOIN customers c ON c.id = a.customer_id JOIN users u ON u.id = le.performed_by
      WHERE ${clauses.join(' AND ')}
      ORDER BY le.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function customerStatement({ customerCode, from, to, limit = 50, offset = 0 }) {
  const { rows: custRows } = await pool.query(
    `SELECT c.customer_code, c.full_name, a.id AS account_id, COALESCE(ab.balance,0) AS balance
       FROM customers c JOIN accounts a ON a.customer_id = c.id LEFT JOIN account_balances ab ON ab.account_id = a.id
      WHERE c.customer_code = $1`,
    [customerCode]
  );
  if (custRows.length === 0) throw makeAppError(404, 'Customer not found');
  const customer = custRows[0];

  const clauses = [`account_id = $1`, `status = 'completed'`];
  const params = [customer.account_id];
  if (from) { params.push(from); clauses.push(`created_at >= $${params.length}`); }
  if (to) { params.push(to); clauses.push(`created_at <= $${params.length}`); }
  params.push(limit, offset);

  const { rows: history } = await pool.query(
    `SELECT transaction_code, entry_type, signed_amount, created_at FROM ledger_entries
      WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { customer, history };
}

module.exports = { dashboard, summary, byWorker, transactionsReport, customerStatement };
