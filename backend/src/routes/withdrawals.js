const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/withdrawalsController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { requestValidator, decideValidator, listValidator } = require('../validators/withdrawalValidators');

const router = express.Router();

// Applied to request creation specifically — tighter than the general
// API limiter, since nothing should let a compromised/buggy worker
// session flood the admin's approval queue.
const withdrawalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many withdrawal requests. Try again later.' },
});

router.post('/request', requireAuth, requireRole('admin', 'worker'), withdrawalLimiter, requestValidator, controller.request);
router.post('/:id/decide', requireAuth, requireRole('admin'), decideValidator, controller.decide);
router.get('/', requireAuth, requireRole('admin'), listValidator, controller.list);

module.exports = router;
