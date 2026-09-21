const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const env = require('../config/env');

// Server-side RBAC enforcement, per docs/roles-and-permissions.md's
// "enforcement is a backend concern, full stop." No route anywhere
// trusts a client-supplied role field, and hiding a frontend button is
// never treated as a security control.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { rows } = await pool.query(
    `SELECT s.id, u.id AS user_id, u.status, u.force_password_change, r.name AS role_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [payload.sessionId]
  );
  if (rows.length === 0) return res.status(401).json({ error: 'Session no longer valid' });

  const session = rows[0];
  if (session.status !== 'active') return res.status(403).json({ error: 'Account is not active' });

  req.user = { id: session.user_id, role: session.role_name, sessionId: session.id, forcePasswordChange: session.force_password_change };

  // /api/auth/me is allowed here on purpose: the frontend calls it
  // right after login to learn who's signed in and whether a forced
  // password change is pending, so it can route to the change-password
  // screen instead of getting stuck. It returns only the caller's own
  // non-financial profile (name, staff code, role, this flag) — nothing
  // that requires the password change to have happened first.
  const allowedWhileForced = ['/api/auth/change-password', '/api/auth/logout', '/api/auth/me'];
  if (req.user.forcePasswordChange && !allowedWhileForced.includes(req.originalUrl.split('?')[0])) {
    return res.status(403).json({ error: 'Password change required before continuing', code: 'PASSWORD_CHANGE_REQUIRED' });
  }
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
