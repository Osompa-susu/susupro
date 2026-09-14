const { pool } = require('../db/pool');

// Read-only, always — there is no function in this file that mutates
// audit_logs, and the database's own trigger blocks it even if one
// were added here by mistake later.
async function listAuditLogs({ limit = 60 }) {
  const { rows } = await pool.query(
    `SELECT al.created_at, al.action, al.entity_type, al.entity_id, al.details, u.full_name AS actor_name
       FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_user_id
      ORDER BY al.created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = { listAuditLogs };
