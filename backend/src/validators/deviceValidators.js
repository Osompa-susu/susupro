const { body, param } = require('express-validator');

const registerDeviceValidator = [
  body('deviceCode').isString().trim().isLength({ min: 2, max: 30 }),
  body('label').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('assignedTo').optional({ nullable: true }).isUUID(),
];

const setStatusValidator = [
  param('id').isUUID(),
  body('status').isIn(['active', 'deactivated']),
];

module.exports = { registerDeviceValidator, setStatusValidator };
