const { body, query, param } = require('express-validator');

const registerValidator = [
  body('fullName').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.'),
  body('phone').isString().trim().isLength({ min: 9, max: 15 }).withMessage('Enter a valid phone number.'),
  body('community').optional({ nullable: true }).isString().trim().isLength({ max: 100 }).withMessage('Community name is too long.'),
  body('savingsPlan').optional({ nullable: true }).isString().trim().isLength({ max: 50 }).withMessage('Invalid savings plan.'),
  body('smsNotificationsEnabled').optional({ nullable: true }).isBoolean().withMessage('SMS preference must be true or false.'),
];

const searchValidator = [
  query('q').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Enter a search term.'),
];

const customerCodeValidator = [
  param('customerCode').matches(/^SUS-\d{6}$/).withMessage('Invalid customer code.'),
];

const smsConsentValidator = [
  param('customerCode').matches(/^SUS-\d{6}$/).withMessage('Invalid customer code.'),
  body('enabled').isBoolean().withMessage('SMS preference must be true or false.'),
];

module.exports = { registerValidator, searchValidator, customerCodeValidator, smsConsentValidator };