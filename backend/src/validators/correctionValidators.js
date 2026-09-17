const { body } = require('express-validator');

const correctionValidator = [
  body('originalTransactionCode').isString().trim().notEmpty().withMessage('Select the transaction to correct.'),
  body('correctedAmount').isFloat().withMessage('Enter a valid corrected amount.'),
  body('reason').isString().trim().isLength({ min: 5, max: 300 }).withMessage('Reason must be between 5 and 300 characters.'),
];

module.exports = { correctionValidator };