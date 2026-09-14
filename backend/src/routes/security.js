const express = require('express');
const controller = require('../controllers/securityController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.get('/summary', requireAuth, requireRole('admin'), controller.summary);

module.exports = router;
