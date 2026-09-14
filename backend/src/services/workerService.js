const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { logAudit } = require('../utils/audit');
const { SALT_ROUNDS } = require('./authService');

function makeAppError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function listWorkers({ limit = 50, offset = 0 }) {
  const { rows } = await pool.query(
    `SELECT u.id, u.staff_code, u.full_name, u.phone, u.status, r.name AS role
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'worker'
      ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function addWorker({ fullName, phone, temporaryPassword, addedBy, ip }) {
  const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
  // Phase 15 lesson applied from the start: staff_code from a
  // SEQUENCE, never COUNT(*)+1.
  const { rows } = await pool.query(
    `INSERT INTO users (staff_code, full_name, phone, password_hash, role_id, status, force_password_change)
     VALUES ('W-' || lpad(nextval('worker_code_seq')::text, 3, '0'), $1, $2, $3,
             (SELECT id FROM roles WHERE name='worker'), 'active', true)
     RETURNING id, staff_code`,
    [fullName, phone, passwordHash]
  );
  await logAudit(pool, { actorUserId: addedBy, action: 'WORKER_CREATED', entityType: 'user', entityId: rows[0].id, details: { staffCode: rows[0].staff_code }, ip });
  return rows[0];
}

async function setWorkerStatus({ workerId, status, changedBy, ip }) {
  const { rows } = await pool.query(
    `UPDATE users SET status = $1, updated_at = now() WHERE id = $2 AND role_id = (SELECT id FROM roles WHERE name='worker') RETURNING id, staff_code, status`,
    [status, workerId]
  );
  if (rows.length === 0) throw makeAppError(404, 'Worker not found');
  if (status !== 'active') {
    await pool.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [workerId]);
  }
  await logAudit(pool, { actorUserId: changedBy, action: 'WORKER_STATUS_CHANGED', entityType: 'user', entityId: workerId, details: { newStatus: status }, ip });
  return rows[0];
}

async function resetWorkerPassword({ workerId, temporaryPassword, resetBy, ip }) {
  const passwordHash = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $1, force_password_change = true, failed_login_count = 0, locked_until = NULL, updated_at = now()
     WHERE id = $2 AND role_id = (SELECT id FROM roles WHERE name='worker') RETURNING id`,
    [passwordHash, workerId]
  );
  if (rows.length === 0) throw makeAppError(404, 'Worker not found');
  await pool.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [workerId]);
  await logAudit(pool, { actorUserId: resetBy, action: 'WORKER_PASSWORD_RESET', entityType: 'user', entityId: workerId, ip });
}

module.exports = { listWorkers, addWorker, setWorkerStatus, resetWorkerPassword };
