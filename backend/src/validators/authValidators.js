const { body, param } = require('express-validator');

const loginValidator = [
  body('phone').isString().trim().notEmpty().withMessage('Enter a phone number.'),
  body('password').isString().notEmpty().withMessage('Enter a password.'),
  body('deviceCode').optional({ nullable: true }).isString().trim().isLength({ max: 30 }).withMessage('Device code is too long.'),
  body('totpCode').optional({ nullable: true }).isString().trim().matches(/^\d{6}$/).withMessage('Authenticator code must be exactly 6 digits.'),
];

const changePasswordValidator = [
  body('currentPassword').isString().notEmpty().withMessage('Enter your current password.'),
  body('newPassword').isString().isLength({ min: 10 }).withMessage('New password must be at least 10 characters.'),
];

const mfaCodeValidator = [
  body('totpCode').isString().trim().matches(/^\d{6}$/).withMessage('Authenticator code must be exactly 6 digits.'),
];
const disableMfaValidator = [
  body('currentPassword').isString().notEmpty().withMessage('Enter your current password.'),
  body('totpCode').isString().trim().matches(/^\d{6}$/).withMessage('Authenticator code must be exactly 6 digits.'),
];
const resetMfaValidator = [
  param('userId').isUUID().withMessage('Invalid user reference.'),
];

module.exports = { loginValidator, changePasswordValidator, mfaCodeValidator, disableMfaValidator, resetMfaValidator };