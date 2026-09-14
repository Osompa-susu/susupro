const { body } = require('express-validator');

const correctionValidator = [
  body('originalTransactionCode').isString().trim().notEmpty(),
  body('correctedAmount').isFloat(),
  body('reason').isString().trim().isLength({ min: 5, max: 300 }),
];

module.exports = { correctionValidator };
