const { validationResult } = require('express-validator');
const deviceService = require('../services/deviceService');

async function list(req, res, next) {
  try { res.json({ devices: await deviceService.listDevices() }); } catch (err) { next(err); }
}
async function create(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    const device = await deviceService.registerDevice({ deviceCode: req.body.deviceCode, label: req.body.label, assignedTo: req.body.assignedTo, registeredBy: req.user.id, ip: req.ip });
    res.status(201).json(device);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}
async function setStatus(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    res.json(await deviceService.setDeviceStatus({ deviceId: req.params.id, status: req.body.status, changedBy: req.user.id, ip: req.ip }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { list, create, setStatus };
