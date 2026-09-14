const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const { logAudit, logSecurityEvent } = require('../utils/audit');
const { generateSecret, generateTOTP, verifyTOTP } = require('../utils/totp');
const env = require('../config/env');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_HOURS = 8;
const SALT_ROUNDS = 12;

function makeAppError(status, message, appCode) {
  const err = new Error(message);
  err.status = status;
  if (appCode) err.appCode = appCode; // distinct from pg's own err.code (e.g. '23505'), never collides
  return err;
}

async function login({ phone, password, deviceCode, totpCode, ip, userAgent }) {
  const { rows } = await pool.query(
    `SELECT u.id, u.password_hash, u.status, u.failed_login_count, u.locked_until, u.force_password_change,
            u.mfa_enabled, u.mfa_secret, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.phone = $1`,
    [phone]
  );

  // Identical failure message whether the phone doesn't exist or the
  // password is wrong — never leak which one it was.
  if (rows.length === 0) {
    await logSecurityEvent(pool, { eventType: 'LOGIN_FAILED', ip, details: { phone, reason: 'no_such_user' } });
    await logAudit(pool, { action: 'LOGIN_FAILED', ip, details: { phone, reason: 'no_such_user' } });
    throw makeAppError(401, 'Invalid phone or password');
  }
  const user = rows[0];

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await logSecurityEvent(pool, { eventType: 'LOGIN_BLOCKED_LOCKED', userId: user.id, ip });
    throw makeAppError(403, 'Account temporarily locked. Try again later.');
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    const newCount = user.failed_login_count + 1;
    const lockUntil = newCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
    await pool.query(`UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3`, [newCount, lockUntil, user.id]);
    await logSecurityEvent(pool, { eventType: 'LOGIN_FAILED', userId: user.id, ip, details: { reason: 'bad_password', attempt: newCount } });
    await logAudit(pool, { actorUserId: user.id, action: 'LOGIN_FAILED', ip, details: { reason: 'bad_password' } });
    throw makeAppError(401, 'Invalid phone or password');
  }

  if (user.status !== 'active') {
    await logSecurityEvent(pool, { eventType: 'LOGIN_BLOCKED_INACTIVE', userId: user.id, ip });
    throw makeAppError(403, `This account is ${user.status}.`);
  }

  // MFA check happens AFTER password verification but BEFORE the
  // session is created — an attacker who guesses/steals the password
  // still cannot get a session without also passing this. Enforced
  // entirely server-side; the frontend has no way to skip this check.
  if (user.mfa_enabled) {
    if (!totpCode) {
      throw makeAppError(401, 'MFA code required', 'MFA_REQUIRED');
    }
    if (!verifyTOTP(user.mfa_secret, totpCode)) {
      await logSecurityEvent(pool, { eventType: 'MFA_FAILED', userId: user.id, ip });
      await logAudit(pool, { actorUserId: user.id, action: 'MFA_FAILED', ip });
      throw makeAppError(401, 'Invalid MFA code');
    }
  }

  await pool.query(`UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1`, [user.id]);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  // Phase 16: if a device code is presented (a tablet identifying
  // itself), the session is tied to that device — this is what makes
  // "deactivate this tablet" independently revoke only that device's
  // sessions, without touching the worker's other logins or password.
  // An unknown/deactivated device code is not fatal (a browser login
  // with no device at all is valid), but is worth surfacing.
  let deviceId = null;
  let deviceWarning = null;
  if (deviceCode) {
    const deviceRow = await pool.query(`SELECT id, status FROM devices WHERE device_code = $1`, [deviceCode]);
    if (deviceRow.rows.length === 0) {
      deviceWarning = 'Unrecognized device code — logging in without device tracking.';
    } else if (deviceRow.rows[0].status !== 'active') {
      throw makeAppError(403, 'This device has been deactivated. Contact your admin.');
    } else {
      deviceId = deviceRow.rows[0].id;
    }
  }

  const sessionResult = await pool.query(
    `INSERT INTO sessions (user_id, device_id, token_hash, ip_address, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [user.id, deviceId, tokenHash, ip, userAgent, expiresAt]
  );
  const sessionId = sessionResult.rows[0].id;
  const jwtToken = jwt.sign({ sessionId }, env.JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });

  await logAudit(pool, { actorUserId: user.id, action: 'LOGIN_SUCCESS', ip, details: deviceId ? { deviceCode } : undefined });

  return { token: jwtToken, role: user.role_name, forcePasswordChange: user.force_password_change, deviceWarning };
}

async function logout({ userId, sessionId, ip }) {
  await pool.query(`UPDATE sessions SET revoked_at = now() WHERE id = $1`, [sessionId]);
  await logAudit(pool, { actorUserId: userId, action: 'LOGOUT', ip });
}

async function getMe(userId) {
  const { rows } = await pool.query(
    `SELECT id, staff_code, full_name, phone, force_password_change, (SELECT name FROM roles WHERE id = role_id) AS role
       FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) throw makeAppError(404, 'User not found');
  const u = rows[0];
  return { id: u.id, staffCode: u.staff_code, fullName: u.full_name, phone: u.phone, role: u.role, forcePasswordChange: u.force_password_change };
}

async function changePassword({ userId, sessionId, currentPassword, newPassword, ip }) {
  const { rows } = await pool.query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) {
    await logSecurityEvent(pool, { eventType: 'PASSWORD_CHANGE_FAILED', userId, ip });
    throw makeAppError(401, 'Current password is incorrect');
  }
  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query(`UPDATE users SET password_hash = $1, force_password_change = false, updated_at = now() WHERE id = $2`, [newHash, userId]);
  // Revoke every OTHER session — a password change should end any
  // other active login, in case it was prompted by a suspected compromise.
  await pool.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL`, [userId, sessionId]);
  await logAudit(pool, { actorUserId: userId, action: 'PASSWORD_CHANGED', ip });
}

module.exports = { login, logout, getMe, changePassword, SALT_ROUNDS };

// ---------------------------------------------------------------------
// MFA — TOTP setup flow. Two-step by design: setupMfa generates and
// stores a secret but leaves mfa_enabled false, so a user who
// abandons setup partway through isn't accidentally locked out by a
// secret they never actually confirmed receiving. Only confirmSetup
// (which requires proving a valid code) flips mfa_enabled to true.
// ---------------------------------------------------------------------
async function setupMfa({ userId, ip }) {
  const secret = generateSecret();
  await pool.query(`UPDATE users SET mfa_secret = $1, mfa_enabled = false WHERE id = $2`, [secret, userId]);
  await logAudit(pool, { actorUserId: userId, action: 'MFA_SETUP_STARTED', ip });
  // The secret is returned ONCE, here, for the admin to enter into
  // their authenticator app (or scan via a QR code built from it on
  // the frontend) — it is never sent again after this response, and
  // GET /api/auth/me deliberately never includes it.
  return { secret, otpauthLabel: `SusuPro` };
}

async function confirmMfaSetup({ userId, totpCode, ip }) {
  const { rows } = await pool.query(`SELECT mfa_secret FROM users WHERE id = $1`, [userId]);
  if (!rows[0].mfa_secret) throw makeAppError(400, 'No MFA setup in progress — call setup first');
  if (!verifyTOTP(rows[0].mfa_secret, totpCode)) {
    throw makeAppError(401, 'Invalid MFA code');
  }
  await pool.query(`UPDATE users SET mfa_enabled = true WHERE id = $1`, [userId]);
  await logAudit(pool, { actorUserId: userId, action: 'MFA_ENABLED', ip });
}

async function disableMfa({ userId, currentPassword, totpCode, ip }) {
  const { rows } = await pool.query(`SELECT password_hash, mfa_secret FROM users WHERE id = $1`, [userId]);
  const passwordOk = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!passwordOk) throw makeAppError(401, 'Current password is incorrect');
  if (!verifyTOTP(rows[0].mfa_secret, totpCode)) throw makeAppError(401, 'Invalid MFA code');
  await pool.query(`UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1`, [userId]);
  await logAudit(pool, { actorUserId: userId, action: 'MFA_DISABLED', ip });
}

module.exports.setupMfa = setupMfa;
module.exports.confirmMfaSetup = confirmMfaSetup;
module.exports.disableMfa = disableMfa;

// ---------------------------------------------------------------------
// Account recovery consideration (explicitly required by the master
// prompt's Priority 3): if an admin loses their authenticator device,
// disableMfa() above is unreachable — it requires a valid TOTP code by
// design (that's the whole point of MFA). The realistic recovery path
// for a business with more than one admin is a second admin resetting
// the locked-out admin's MFA, below. This does NOT solve the single-
// admin bootstrap case (one admin, one lost phone, no other admin to
// help) — that scenario has no safe self-service answer without a
// weaker recovery mechanism (e.g. printed backup codes) that wasn't
// built here, and shouldn't be silently assumed solved. Documented as
// an open operational gap in the phase report, not glossed over.
// ---------------------------------------------------------------------
async function resetMfaForUser({ targetUserId, resetBy, ip }) {
  const { rows } = await pool.query(`UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1 RETURNING id`, [targetUserId]);
  if (rows.length === 0) throw makeAppError(404, 'User not found');
  await logAudit(pool, { actorUserId: resetBy, action: 'MFA_RESET_BY_ADMIN', entityType: 'user', entityId: targetUserId, ip });
}
module.exports.resetMfaForUser = resetMfaForUser;
