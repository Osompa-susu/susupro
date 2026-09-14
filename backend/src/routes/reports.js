const express = require('express');
const controller = require('../controllers/reportsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
// Admin-only for the whole router, in one line — per Section 21/master
// prompt "do not expose unauthorized customer information." A worker's
// own equivalent is a different, already-scoped endpoint (/api/transactions/mine).
router.use(requireAuth, requireRole('admin'));

router.get('/dashboard', controller.dashboard);
router.get('/summary', controller.summary);
router.get('/by-worker', controller.byWorker);
router.get('/transactions', controller.transactionsReport);
router.get('/customer/:customerCode', controller.customerStatement);

module.exports = router;
