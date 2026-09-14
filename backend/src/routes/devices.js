const express = require('express');
const controller = require('../controllers/devicesController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { registerDeviceValidator, setStatusValidator } = require('../validators/deviceValidators');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', controller.list);
router.post('/', registerDeviceValidator, controller.create);
router.patch('/:id/status', setStatusValidator, controller.setStatus);

module.exports = router;
