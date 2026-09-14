const express = require('express');
const controller = require('../controllers/auditController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.get('/', requireAuth, requireRole('admin'), controller.list);

module.exports = router;
