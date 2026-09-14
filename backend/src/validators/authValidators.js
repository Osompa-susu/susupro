const { body } = require('express-validator');

const loginValidator = [
  body('phone').isString().trim().notEmpty(),
  body('password').isString().notEmpty(),
  body('deviceCode').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('totpCode').optional({ nullable: true }).isString().trim().matches(/^\d{6}$/),
];

const changePasswordValidator = [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 10 }),
];

module.exports = { loginValidator, changePasswordValidator };

// Appended for MFA (Priority 3 hardening pass).
const { body: mfaBody, param: mfaParam } = require('express-validator');
const mfaCodeValidator = [mfaBody('totpCode').isString().trim().matches(/^\d{6}$/)];
const disableMfaValidator = [mfaBody('currentPassword').isString().notEmpty(), mfaBody('totpCode').isString().trim().matches(/^\d{6}$/)];
const resetMfaValidator = [mfaParam('userId').isUUID()];
module.exports.mfaCodeValidator = mfaCodeValidator;
module.exports.disableMfaValidator = disableMfaValidator;
module.exports.resetMfaValidator = resetMfaValidator;
