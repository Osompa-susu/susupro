const { body, param, query } = require('express-validator');

const requestValidator = [
  body('customerCode').isString().trim().matches(/^SUS-\d{6}$/).withMessage('Invalid customer code.'),
  body('amount').isFloat({ gt: 0 }).withMessage('Enter an amount greater than 0.'),
];

const decideValidator = [
  param('id').isUUID().withMessage('Invalid withdrawal request reference.'),
  body('decision').isIn(['approve', 'reject']).withMessage('Decision must be approve or reject.'),
  body('reason').optional({ nullable: true }).isString().trim().isLength({ max: 300 }).withMessage('Reason is too long.'),
];

const listValidator = [
  query('status').optional({ nullable: true }).isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status filter.'),
];

module.exports = { requestValidator, decideValidator, listValidator };