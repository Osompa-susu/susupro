const express = require('express');
const controller = require('../controllers/billingController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Manual safety-net trigger for the automated monthly susu collection
// fee — lets an admin run/re-run it on demand (e.g. to test it right
// now instead of waiting for the 1st, or to catch up after an
// extended outage) rather than only ever firing from the background
// scheduler in jobs/monthlyFeeJob.js.
router.post('/monthly-fees/run', requireAuth, requireRole('admin'), controller.runMonthlyFees);

module.exports = router;
