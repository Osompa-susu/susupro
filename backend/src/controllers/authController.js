const { validationResult } = require('express-validator');
const authService = require('../services/authService');

async function login(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    const result = await authService.login({
      phone: req.body.phone.trim().replace(/\s+/g, ''),
      password: req.body.password,
      deviceCode: req.body.deviceCode || null,
      totpCode: req.body.totpCode || null,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    res.json(result);
  } catch (err) {
    if (err.status) {
      const body = { error: err.message };
      if (err.appCode) body.code = err.appCode; // e.g. 'MFA_REQUIRED', so the frontend can show a code field
      return res.status(err.status).json(body);
    }
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout({ userId: req.user.id, sessionId: req.user.sessionId, ip: req.ip });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    res.json(await authService.getMe(req.user.id));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function changePassword(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    await authService.changePassword({
      userId: req.user.id, sessionId: req.user.sessionId,
      currentPassword: req.body.currentPassword, newPassword: req.body.newPassword, ip: req.ip,
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { login, logout, me, changePassword };

async function setupMfa(req, res, next) {
  try { res.json(await authService.setupMfa({ userId: req.user.id, ip: req.ip })); } catch (err) { next(err); }
}
async function confirmMfaSetup(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    await authService.confirmMfaSetup({ userId: req.user.id, totpCode: req.body.totpCode, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}
async function disableMfa(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    await authService.disableMfa({ userId: req.user.id, currentPassword: req.body.currentPassword, totpCode: req.body.totpCode, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}
async function resetMfaForUser(req, res, next) {
  try {
    await authService.resetMfaForUser({ targetUserId: req.params.userId, resetBy: req.user.id, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports.setupMfa = setupMfa;
module.exports.confirmMfaSetup = confirmMfaSetup;
module.exports.disableMfa = disableMfa;
module.exports.resetMfaForUser = resetMfaForUser;
