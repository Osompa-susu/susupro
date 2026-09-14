const { body, param, query } = require('express-validator');

const requestValidator = [
  body('customerCode').isString().trim().matches(/^SUS-\d{6}$/),
  body('amount').isFloat({ gt: 0 }),
];

const decideValidator = [
  param('id').isUUID(),
  body('decision').isIn(['approve', 'reject']),
  body('reason').optional({ nullable: true }).isString().trim().isLength({ max: 300 }),
];

const listValidator = [
  query('status').optional({ nullable: true }).isIn(['pending', 'approved', 'rejected']),
];

module.exports = { requestValidator, decideValidator, listValidator };
