const express = require('express');
const controller = require('../controllers/customersController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { registerValidator, searchValidator, customerCodeValidator } = require('../validators/customerValidators');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'worker'));
// ASSUMPTION (docs/unresolved-questions.md #1): both roles can
// register/search/view customers by default. Confirm with the owner.

router.post('/', registerValidator, controller.register);
router.get('/search', searchValidator, controller.search);
router.get('/:customerCode', customerCodeValidator, controller.getByCode);

module.exports = router;
