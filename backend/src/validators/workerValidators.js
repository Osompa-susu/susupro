const { body } = require('express-validator');

const addWorkerValidator = [
  body('fullName').isString().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters.'),
  body('phone').isString().trim().isLength({ min: 9 }).withMessage('Enter a valid phone number.'),
  body('temporaryPassword').isString().isLength({ min: 10 }).withMessage('Temporary password must be at least 10 characters.'),
];

const setStatusValidator = [
  body('status').isIn(['active', 'suspended', 'deactivated']).withMessage('Status must be active, suspended, or deactivated.'),
];

const resetPasswordValidator = [
  body('temporaryPassword').isString().isLength({ min: 10 }).withMessage('Temporary password must be at least 10 characters.'),
];

module.exports = { addWorkerValidator, setStatusValidator, resetPasswordValidator };
