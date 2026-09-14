const express = require('express');
const controller = require('../controllers/transactionsController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { depositValidator } = require('../validators/transactionValidators');
const { correctionValidator } = require('../validators/correctionValidators');

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'worker'));

router.post('/deposit', depositValidator, controller.deposit);
router.get('/mine', controller.mine);
router.post('/corrections', requireRole('admin'), correctionValidator, controller.correct);

module.exports = router;
