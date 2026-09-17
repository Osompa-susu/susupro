const { body } = require('express-validator');

const depositValidator = [
  body('customerCode').isString().trim().matches(/^SUS-\d{6}$/).withMessage('Customer code looks invalid.'),
  body('amount').isFloat({ gt: 0, lt: 1000000 }).withMessage('Enter an amount greater than 0 and less than GHS 1,000,000.'),
  body('idempotencyKey').isString().trim().isLength({ min: 10, max: 100 }).withMessage('Missing or invalid request identifier — please try again.'),
];

module.exports = { depositValidator };