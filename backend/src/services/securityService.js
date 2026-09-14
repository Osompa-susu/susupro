const { pool } = require('../db/pool');

async function summary() {
  const [{ rows: failedLogins }, { rows: suspended }, { rows: activeSessions }, { rows: sensitive }] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS n FROM audit_logs WHERE action = 'LOGIN_FAILED' AND created_at > now() - interval '24 hours'`),
    pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE status != 'active'`),
    pool.query(`SELECT COUNT(*)::int AS n FROM sessions WHERE revoked_at IS NULL AND expires_at > now()`),
    pool.query(
      `SELECT al.created_at, al.action, u.full_name AS actor_name
         FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_user_id
        WHERE al.action IN ('LOGIN_FAILED','WORKER_STATUS_CHANGED','WITHDRAWAL_APPROVED','TRANSACTION_CORRECTED','TRANSACTION_REVERSED','WORKER_PASSWORD_RESET')
        ORDER BY al.created_at DESC LIMIT 10`
    ),
  ]);
  return {
    failedLoginsLast24h: failedLogins[0].n,
    suspendedOrDeactivatedAccounts: suspended[0].n,
    activeSessions: activeSessions[0].n,
    sensitiveActions: sensitive,
    // Backup status is genuinely not something this service can report
    // on — it depends on the Phase 14 backup job's own execution, which
    // is infrastructure outside the application. Never fabricate this.
    backupStatus: 'See docs/phase-reports/phase-14.md — not tracked by the application itself.',
  };
}

module.exports = { summary };
