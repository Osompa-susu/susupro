const { body, param } = require('express-validator');

const registerDeviceValidator = [
  body('deviceCode').isString().trim().isLength({ min: 2, max: 30 }).withMessage('Device code must be between 2 and 30 characters.'),
  body('label').optional({ nullable: true }).isString().trim().isLength({ max: 100 }).withMessage('Label is too long.'),
  body('assignedTo').optional({ nullable: true }).isUUID().withMessage('Invalid worker reference.'),
];

const setStatusValidator = [
  param('id').isUUID().withMessage('Invalid device reference.'),
  body('status').isIn(['active', 'deactivated']).withMessage('Status must be active or deactivated.'),
];

module.exports = { registerDeviceValidator, setStatusValidator };