const express = require('express');
const controller = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { loginLimiter, mfaLimiter } = require('../middleware/rateLimiter');
const {
  loginValidator, changePasswordValidator, mfaCodeValidator, disableMfaValidator, resetMfaValidator,
} = require('../validators/authValidators');

const router = express.Router();

router.post('/login', loginLimiter, loginValidator, controller.login);
router.post('/logout', requireAuth, controller.logout);
router.get('/me', requireAuth, controller.me);
router.post('/change-password', requireAuth, changePasswordValidator, controller.changePassword);

// MFA — admin-only feature per the master prompt's Priority 3 scope,
// but the middleware itself doesn't hard-block a worker from calling
// setup (there's no product reason a worker couldn't also enable MFA
// for their own account voluntarily) — enforced instead by which role
// is REQUIRED to log in with it (only admins are required to; workers
// who set it up would just also need a code at login, harmlessly).
router.post('/mfa/setup', requireAuth, controller.setupMfa);
router.post('/mfa/confirm', requireAuth, mfaLimiter, mfaCodeValidator, controller.confirmMfaSetup);
router.post('/mfa/disable', requireAuth, mfaLimiter, disableMfaValidator, controller.disableMfa);
// Admin-assisted recovery for a DIFFERENT locked-out admin — never for oneself (that's what /disable is for, and it correctly requires proving you still have your own code).
router.post('/mfa/reset/:userId', requireAuth, requireRole('admin'), resetMfaValidator, controller.resetMfaForUser);

module.exports = router;
