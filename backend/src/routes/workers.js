const express = require('express');
const controller = require('../controllers/workersController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { addWorkerValidator, setStatusValidator, resetPasswordValidator } = require('../validators/workerValidators');

const router = express.Router();
router.use(requireAuth, requireRole('admin')); // every worker-management route is admin-only

router.get('/', controller.list);
router.post('/', addWorkerValidator, controller.create);
router.patch('/:id/status', setStatusValidator, controller.setStatus);
router.post('/:id/reset-password', resetPasswordValidator, controller.resetPassword);

module.exports = router;
