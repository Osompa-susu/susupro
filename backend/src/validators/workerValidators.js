const { body } = require('express-validator');

const addWorkerValidator = [
  body('fullName').isString().trim().isLength({ min: 2 }),
  body('phone').isString().trim().isLength({ min: 9 }),
  body('temporaryPassword').isString().isLength({ min: 10 }),
];

const setStatusValidator = [
  body('status').isIn(['active', 'suspended', 'deactivated']),
];

const resetPasswordValidator = [
  body('temporaryPassword').isString().isLength({ min: 10 }),
];

module.exports = { addWorkerValidator, setStatusValidator, resetPasswordValidator };
