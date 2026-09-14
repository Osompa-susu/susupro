const { body, query, param } = require('express-validator');

const registerValidator = [
  body('fullName').isString().trim().isLength({ min: 2, max: 100 }),
  body('phone').isString().trim().isLength({ min: 9, max: 15 }),
  body('community').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('savingsPlan').optional({ nullable: true }).isString().trim().isLength({ max: 50 }),
];

const searchValidator = [
  query('q').isString().trim().isLength({ min: 1, max: 100 }),
];

const customerCodeValidator = [
  param('customerCode').matches(/^SUS-\d{6}$/),
];

module.exports = { registerValidator, searchValidator, customerCodeValidator };
