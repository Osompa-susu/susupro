const { body } = require('express-validator');

const depositValidator = [
  body('customerCode').isString().trim().matches(/^SUS-\d{6}$/),
  body('amount').isFloat({ gt: 0, lt: 1000000 }), // ASSUMPTION: no confirmed max deposit — see docs/unresolved-questions.md
  body('idempotencyKey').isString().trim().isLength({ min: 10, max: 100 }),
];

module.exports = { depositValidator };
