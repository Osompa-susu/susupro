const { pool, withTransaction } = require('../db/pool');
const { logAudit } = require('../utils/audit');

function makeAppError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ---------------------------------------------------------------------
// DEPOSIT — the complete atomic workflow the master prompt's Section 8
// specifies: validate -> lock/verify account -> read authoritative
// balance -> create transaction -> update (derived) balance -> create
// audit record, all inside one BEGIN/COMMIT, or nothing happens at all.
// ---------------------------------------------------------------------
async function deposit({ customerCode, amount, performedBy, idempotencyKey, ip }) {
  const amountFixed = Math.round(Number(amount) * 100) / 100;

  return withTransaction(async (client) => {
    // Idempotency check FIRST, inside the same transaction as the
    // insert, so a concurrent retry can't slip in between the check
    // and the insert.
    const existing = await client.query(`SELECT id, transaction_code FROM ledger_entries WHERE idempotency_key = $1`, [idempotencyKey]);
    if (existing.rows.length > 0) {
      return { transaction: existing.rows[0], deduplicated: true };
    }

    const { rows } = await client.query(
      `SELECT a.id AS account_id FROM accounts a
         JOIN customers c ON c.id = a.customer_id
        WHERE c.customer_code = $1 AND c.status = 'active' AND a.status = 'active'
        FOR UPDATE`,
      [customerCode]
    );
    if (rows.length === 0) throw makeAppError(404, 'Customer not found or inactive');
    const accountId = rows[0].account_id;

    const entry = await client.query(
      `INSERT INTO ledger_entries (account_id, entry_type, signed_amount, performed_by, status, idempotency_key)
       VALUES ($1, 'deposit', $2, $3, 'completed', $4)
       RETURNING id, transaction_code, created_at`,
      [accountId, amountFixed, performedBy, idempotencyKey]
    );

    const { rows: balRows } = await client.query(
      `SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries WHERE account_id = $1 AND status='completed'`,
      [accountId]
    );

    await logAudit(client, {
      actorUserId: performedBy, action: 'DEPOSIT', entityType: 'ledger_entry', entityId: entry.rows[0].id,
      details: { customerCode, amount: amountFixed, transactionCode: entry.rows[0].transaction_code }, ip,
    });

    return { transaction: entry.rows[0], newBalance: balRows[0].balance, deduplicated: false };
  }).catch((err) => {
    if (err.code === '23505') return { deduplicated: true }; // extremely unlikely race on the idempotency key itself
    throw err;
  });
}

// Exposed now for Phase 8's "my transactions" need; grows in Phase 9
// to include withdrawal history in the same call.
async function myRecentTransactions(userId) {
  const { rows: entries } = await pool.query(
    `SELECT le.transaction_code, le.entry_type, le.signed_amount, le.status, le.created_at,
            c.full_name AS customer_name, c.customer_code
       FROM ledger_entries le
       JOIN accounts a ON a.id = le.account_id
       JOIN customers c ON c.id = a.customer_id
      WHERE le.performed_by = $1
      ORDER BY le.created_at DESC LIMIT 50`,
    [userId]
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const { rows: todayAgg } = await pool.query(
    `SELECT COALESCE(SUM(signed_amount) FILTER (WHERE entry_type = 'deposit'), 0) AS todays_collections,
            COUNT(*) FILTER (WHERE entry_type = 'deposit') AS transactions_today
       FROM ledger_entries
      WHERE performed_by = $1 AND created_at::date = $2::date AND status = 'completed'`,
    [userId, todayStr]
  );

  return {
    todaysCollections: todayAgg[0].todays_collections,
    transactionsToday: Number(todayAgg[0].transactions_today),
    recentTransactions: entries,
  };
}

// ---------------------------------------------------------------------
// WITHDRAWALS — two-step request/approve flow.
//
// CONFIRMED BUSINESS RULES (from the business owner, not invented):
//   1. No maximum deposit/withdrawal amount.
//   2. Every account must retain a minimum balance of GHS 50 — a
//      customer can never withdraw their account down below that
//      floor. This is enforced at BOTH request time and approval
//      time, the same defense-in-depth pattern already used for the
//      plain "sufficient balance" check, since the real balance can
//      change between the two moments (another withdrawal, a
//      correction, etc.).
// ---------------------------------------------------------------------
const MINIMUM_BALANCE_RETAINED = 50; // GHS — confirmed with the business owner; not a guess

async function requestWithdrawal({ customerCode, amount, requestedBy, ip }) {
  const amountFixed = Math.round(Number(amount) * 100) / 100;

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT a.id AS account_id, a.status AS account_status, c.status AS customer_status, COALESCE(ab.balance,0) AS balance
         FROM accounts a JOIN customers c ON c.id = a.customer_id
         LEFT JOIN account_balances ab ON ab.account_id = a.id
        WHERE c.customer_code = $1
        FOR UPDATE OF a`,
      [customerCode]
    );
    if (rows.length === 0) throw makeAppError(404, 'Customer not found');
    if (rows[0].account_status !== 'active' || rows[0].customer_status !== 'active') {
      throw makeAppError(422, 'This account is not active');
    }
    const accountId = rows[0].account_id;
    const balance = Number(rows[0].balance);

    // Also count other pending requests on this account, so a worker
    // can't request more than the available (post-minimum-balance)
    // amount by splitting it across several pending requests before
    // any is approved.
    const { rows: pendingRows } = await client.query(
      `SELECT COALESCE(SUM(amount),0) AS pending_total FROM withdrawal_requests WHERE account_id = $1 AND status = 'pending'`,
      [accountId]
    );
    const alreadyPending = Number(pendingRows[0].pending_total);
    const availableToWithdraw = balance - MINIMUM_BALANCE_RETAINED;
    if (alreadyPending + amountFixed > availableToWithdraw) {
      throw makeAppError(
        422,
        availableToWithdraw <= 0
          ? `This account must keep a minimum balance of GHS ${MINIMUM_BALANCE_RETAINED.toFixed(2)} — no withdrawal is currently possible.`
          : `Insufficient balance for this request — GHS ${MINIMUM_BALANCE_RETAINED.toFixed(2)} must remain in the account (GHS ${alreadyPending.toFixed(2)} already pending).`
      );
    }

    const reqRes = await client.query(
      `INSERT INTO withdrawal_requests (account_id, amount, requested_by) VALUES ($1, $2, $3) RETURNING id, created_at`,
      [accountId, amountFixed, requestedBy]
    );

    await logAudit(client, {
      actorUserId: requestedBy, action: 'WITHDRAWAL_REQUESTED', entityType: 'withdrawal_request', entityId: reqRes.rows[0].id,
      details: { customerCode, amount: amountFixed }, ip,
    });

    return { requestId: reqRes.rows[0].id, status: 'pending' };
  });
}

async function decideWithdrawal({ requestId, decision, reason, decidedBy, ip }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM withdrawal_requests WHERE id = $1 AND status = 'pending' FOR UPDATE`, [requestId]);
    if (rows.length === 0) throw makeAppError(404, 'Request not found or already decided');
    const wr = rows[0];

    if (decision === 'reject') {
      await client.query(`UPDATE withdrawal_requests SET status='rejected', decided_by=$1, decided_at=now() WHERE id=$2`, [decidedBy, requestId]);
      await client.query(`INSERT INTO approvals (withdrawal_request_id, decided_by, decision, reason) VALUES ($1,$2,'rejected',$3)`, [requestId, decidedBy, reason || null]);
      await logAudit(client, { actorUserId: decidedBy, action: 'WITHDRAWAL_REJECTED', entityType: 'withdrawal_request', entityId: requestId, details: { reason }, ip });
      return { status: 'rejected' };
    }

    // Re-verify at THIS moment, not just at request time — the balance
    // may have changed (another withdrawal approved, a correction).
    // Same GHS 50 floor applies here as at request time — this is the
    // real backstop, since request-time checks a snapshot that can go
    // stale before an admin actually acts on it.
    const { rows: balRows } = await client.query(`SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries WHERE account_id=$1 AND status='completed'`, [wr.account_id]);
    const currentBalance = Number(balRows[0].balance);
    if (currentBalance - Number(wr.amount) < MINIMUM_BALANCE_RETAINED) {
      throw makeAppError(422, `Balance no longer sufficient — GHS ${MINIMUM_BALANCE_RETAINED.toFixed(2)} must remain in the account.`);
    }

    const entry = await client.query(
      `INSERT INTO ledger_entries (account_id, entry_type, signed_amount, performed_by, status, approved_by, approved_at)
       VALUES ($1, 'withdrawal', $2, $3, 'completed', $4, now()) RETURNING id, transaction_code`,
      [wr.account_id, -Math.abs(Number(wr.amount)), wr.requested_by, decidedBy]
    );
    await client.query(`UPDATE withdrawal_requests SET status='approved', decided_by=$1, decided_at=now(), ledger_entry_id=$2 WHERE id=$3`, [decidedBy, entry.rows[0].id, requestId]);
    await client.query(`INSERT INTO approvals (withdrawal_request_id, decided_by, decision) VALUES ($1,$2,'approved')`, [requestId, decidedBy]);

    await logAudit(client, {
      actorUserId: decidedBy, action: 'WITHDRAWAL_APPROVED', entityType: 'ledger_entry', entityId: entry.rows[0].id,
      details: { withdrawalRequestId: requestId, amount: wr.amount, transactionCode: entry.rows[0].transaction_code }, ip,
    });


    return { status: 'approved', transactionCode: entry.rows[0].transaction_code };
  });
}

async function listWithdrawals({ status } = {}) {
  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`wr.status = $${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT wr.id, wr.amount, wr.status, wr.created_at, wr.decided_at,
            c.full_name AS customer_name, c.customer_code,
            ureq.full_name AS requested_by_name, udec.full_name AS decided_by_name,
            COALESCE(ab.balance, 0) AS current_balance
       FROM withdrawal_requests wr
       JOIN accounts a ON a.id = wr.account_id
       JOIN customers c ON c.id = a.customer_id
       JOIN users ureq ON ureq.id = wr.requested_by
       LEFT JOIN users udec ON udec.id = wr.decided_by
       LEFT JOIN account_balances ab ON ab.account_id = a.id
       ${where}
      ORDER BY wr.created_at DESC LIMIT 100`,
    params
  );
  return rows;
}

async function myWithdrawalRequests(userId) {
  const { rows } = await pool.query(
    `SELECT wr.id, wr.amount, wr.status, wr.created_at, c.full_name AS customer_name, c.customer_code
       FROM withdrawal_requests wr
       JOIN accounts a ON a.id = wr.account_id
       JOIN customers c ON c.id = a.customer_id
      WHERE wr.requested_by = $1
      ORDER BY wr.created_at DESC LIMIT 20`,
    [userId]
  );
  return rows;
}

// ---------------------------------------------------------------------
// CORRECTION / REVERSAL — never edits the original row (the schema's
// immutability triggers block that regardless). Inserts an offsetting
// entry linked via reverses_entry_id. A full reversal is simply a
// correction whose delta fully cancels the original — no separate code
// path needed. Admin-only, requires a reason, per Section 10.
// ---------------------------------------------------------------------
async function correct({ originalTransactionCode, correctedAmount, reason, performedBy, ip }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT le.*, a.id AS account_id FROM ledger_entries le
         JOIN accounts a ON a.id = le.account_id
        WHERE le.transaction_code = $1
        FOR UPDATE OF a`, // lock the account, since this is about to affect its current derived balance
      [originalTransactionCode]
    );
    if (rows.length === 0) throw makeAppError(404, 'Original transaction not found');
    const original = rows[0];

    const delta = Math.round((Number(correctedAmount) - Number(original.signed_amount)) * 100) / 100;
    if (delta === 0) throw makeAppError(400, 'Corrected amount matches original; nothing to do');

    // The database trigger also catches this, but checking here first
    // gives a clear 422 instead of a raw trigger-exception 500.
    const { rows: balRows } = await client.query(`SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries WHERE account_id=$1 AND status='completed'`, [original.account_id]);
    const resultingBalance = Number(balRows[0].balance) + delta;
    if (resultingBalance < 0) {
      throw makeAppError(422, `This correction would take the account balance negative (would become GHS ${resultingBalance.toFixed(2)}). Not applied.`);
    }

    const correction = await client.query(
      `INSERT INTO ledger_entries (account_id, entry_type, signed_amount, performed_by, reverses_entry_id, status, note)
       VALUES ($1, 'correction', $2, $3, $4, 'completed', $5) RETURNING id, transaction_code`,
      [original.account_id, delta, performedBy, original.id, reason]
    );

    const isFullReversal = Math.abs(delta) === Math.abs(Number(original.signed_amount)) && Math.sign(delta) !== Math.sign(Number(original.signed_amount));
    await logAudit(client, {
      actorUserId: performedBy, action: isFullReversal ? 'TRANSACTION_REVERSED' : 'TRANSACTION_CORRECTED',
      entityType: 'ledger_entry', entityId: correction.rows[0].id,
      details: { originalTransactionCode, delta, reason }, ip,
    });

    return { correctionCode: correction.rows[0].transaction_code, delta, newBalance: resultingBalance };
  });
}

module.exports = { deposit, myRecentTransactions, requestWithdrawal, decideWithdrawal, listWithdrawals, myWithdrawalRequests, correct };
