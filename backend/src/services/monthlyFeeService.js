const { pool, withTransaction } = require('../db/pool');

const MONTHLY_FEE_AMOUNT = 10.0; // GHS — confirmed with the business owner, 2026-09-21.
const MINIMUM_BALANCE_RETAINED = 50; // GHS — must match ledgerService.js's withdrawal floor.

const SYSTEM_STAFF_CODE = 'SYS-001';
const SYSTEM_PHONE = '000-000-0000-SYS';
const SYSTEM_PLACEHOLDER_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// Finds (or, on a fresh/truncated database, creates) the non-loginable
// system user that automated fee entries are attributed to. Not
// cached — this runs at most once per account per job run, and
// caching across a test-database truncation would leave a dangling
// user id pointing at a row that no longer exists.
async function getSystemUserId(runner) {
  const { rows } = await runner.query(`SELECT id FROM users WHERE staff_code = $1`, [SYSTEM_STAFF_CODE]);
  if (rows.length > 0) return rows[0].id;

  const roleRow = await runner.query(`SELECT id FROM roles WHERE name = 'admin'`);
  const insert = await runner.query(
    `INSERT INTO users (staff_code, full_name, phone, password_hash, role_id, status, force_password_change)
     VALUES ($1, $2, $3, $4, $5, 'suspended', false)
     ON CONFLICT (staff_code) DO NOTHING
     RETURNING id`,
    [SYSTEM_STAFF_CODE, 'SusuPro Automated Billing', SYSTEM_PHONE, SYSTEM_PLACEHOLDER_HASH, roleRow.rows[0].id]
  );
  if (insert.rows.length > 0) return insert.rows[0].id;
  // Extremely rare race: another concurrent call inserted it between our SELECT and INSERT.
  const retry = await runner.query(`SELECT id FROM users WHERE staff_code = $1`, [SYSTEM_STAFF_CODE]);
  return retry.rows[0].id;
}

// Marks every account that made at least one completed deposit LAST
// calendar month as owing the flat GHS 10 fee for it. Pure SQL date
// math (date_trunc against now()) — no JS Date/timezone handling —
// and ON CONFLICT DO NOTHING makes this safe to call more than once
// for the same month; the second call just finds nothing new to add.
async function recordFeesOwedForLastMonth() {
  const { rowCount } = await pool.query(
    `INSERT INTO monthly_fees (account_id, fee_month, amount, status)
     SELECT DISTINCT account_id,
            date_trunc('month', now() - interval '1 month')::date,
            $1,
            'pending'
       FROM ledger_entries
      WHERE entry_type = 'deposit' AND status = 'completed'
        AND created_at >= date_trunc('month', now() - interval '1 month')
        AND created_at <  date_trunc('month', now())
     ON CONFLICT (account_id, fee_month) DO NOTHING`,
    [MONTHLY_FEE_AMOUNT]
  );
  return rowCount;
}

// Charges an account ALL of its outstanding pending fees together as
// one ledger entry, but only if doing so keeps the balance at or above
// the GHS 50 floor — otherwise leaves them pending for a later run to
// retry. This is the "combined with the next month it can afford"
// rule confirmed with the business owner: nothing is ever silently
// forgiven, and nothing is ever charged in a way that would breach
// the floor.
async function tryChargeAccount(accountId) {
  return withTransaction(async (client) => {
    const { rows: pending } = await client.query(
      `SELECT id, amount, to_char(fee_month, 'YYYY-MM') AS month_label
         FROM monthly_fees
        WHERE account_id = $1 AND status = 'pending'
        ORDER BY fee_month ASC
        FOR UPDATE`,
      [accountId]
    );
    if (pending.length === 0) return { charged: false, reason: 'nothing_owed' };

    const totalOwed = Math.round(pending.reduce((sum, r) => sum + Number(r.amount), 0) * 100) / 100;

    const { rows: balRows } = await client.query(
      `SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries WHERE account_id = $1 AND status = 'completed'`,
      [accountId]
    );
    const balance = Number(balRows[0].balance);

    if (balance - totalOwed < MINIMUM_BALANCE_RETAINED) {
      return { charged: false, reason: 'would_breach_minimum_balance', owed: totalOwed, balance };
    }

    const systemUserId = await getSystemUserId(client);
    const monthsList = pending.map((r) => r.month_label).join(', ');

    const feeEntry = await client.query(
      `INSERT INTO ledger_entries (account_id, entry_type, signed_amount, performed_by, status, note)
       VALUES ($1, 'fee', $2, $3, 'completed', $4) RETURNING id`,
      [accountId, -totalOwed, systemUserId, `Monthly susu collection fee — ${monthsList} (GHS ${MONTHLY_FEE_AMOUNT.toFixed(2)} x ${pending.length})`]
    );

    await client.query(
      `UPDATE monthly_fees SET status = 'charged', ledger_entry_id = $1, charged_at = now()
        WHERE id = ANY($2::uuid[])`,
      [feeEntry.rows[0].id, pending.map((r) => r.id)]
    );

    return { charged: true, totalOwed, monthsCharged: pending.length };
  });
}

// The full job: record last month's newly-owed fees, then try to
// collect every account's outstanding balance (this month's plus any
// older unpaid ones). Safe to call any time, any number of times — see
// jobs/monthlyFeeJob.js for why that matters on Render's free tier.
async function runMonthlyFeeJob() {
  const newlyOwing = await recordFeesOwedForLastMonth();

  const { rows: owingAccounts } = await pool.query(`SELECT DISTINCT account_id FROM monthly_fees WHERE status = 'pending'`);

  const results = [];
  for (const { account_id } of owingAccounts) {
    try {
      const outcome = await tryChargeAccount(account_id);
      results.push({ accountId: account_id, ...outcome });
    } catch (err) {
      console.error('[monthly-fee] failed to process account', account_id, err);
      results.push({ accountId: account_id, charged: false, reason: 'error', error: err.message });
    }
  }

  return { newlyOwing, accountsProcessed: results.length, results };
}

module.exports = {
  runMonthlyFeeJob,
  recordFeesOwedForLastMonth,
  tryChargeAccount,
  MONTHLY_FEE_AMOUNT,
  MINIMUM_BALANCE_RETAINED,
};
