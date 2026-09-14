const express = require('express');
const { notImplemented } = require('../utils/notImplemented');
const router = express.Router();

// Accounts are managed implicitly through customer registration
// (Phase 7) and the ledger (Phase 8/9) — this router exists per the
// master prompt's explicit /api/accounts structure request, and is
// where a future direct account-management need (e.g. freezing an
// account independent of the customer record) would live.
router.get('/:accountId', notImplemented('Phase 7 — Customer Management'));

module.exports = router;
