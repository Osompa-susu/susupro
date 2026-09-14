const { pool } = require('../db/pool');
const { logAudit } = require('../utils/audit');

function makeAppError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function listDevices() {
  const { rows } = await pool.query(
    `SELECT d.id, d.device_code, d.label, d.status, u.full_name AS assigned_to_name, u.id AS assigned_to_id
       FROM devices d LEFT JOIN users u ON u.id = d.assigned_to
      ORDER BY d.created_at DESC`
  );
  return rows;
}

async function registerDevice({ deviceCode, label, assignedTo, registeredBy, ip }) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO devices (device_code, label, assigned_to) VALUES ($1, $2, $3) RETURNING id, device_code`,
      [deviceCode, label || null, assignedTo || null]
    );
    await logAudit(pool, { actorUserId: registeredBy, action: 'DEVICE_REGISTERED', entityType: 'device', entityId: rows[0].id, details: { deviceCode }, ip });
    return rows[0];
  } catch (err) {
    if (err.code === '23505') throw makeAppError(409, 'A device with this code already exists');
    throw err;
  }
}

async function setDeviceStatus({ deviceId, status, changedBy, ip }) {
  const { rows } = await pool.query(`UPDATE devices SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, device_code, status`, [status, deviceId]);
  if (rows.length === 0) throw makeAppError(404, 'Device not found');
  if (status === 'deactivated') {
    // Revoke only sessions that originated from THIS device — a lost
    // tablet doesn't require assuming the worker's password itself is
    // compromised, and shouldn't log the worker out of a different,
    // still-safe device.
    await pool.query(`UPDATE sessions SET revoked_at = now() WHERE device_id = $1 AND revoked_at IS NULL`, [deviceId]);
  }
  await logAudit(pool, { actorUserId: changedBy, action: 'DEVICE_STATUS_CHANGED', entityType: 'device', entityId: deviceId, details: { newStatus: status }, ip });
  return rows[0];
}

module.exports = { listDevices, registerDevice, setDeviceStatus };
