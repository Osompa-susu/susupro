const { validationResult } = require('express-validator');
const workerService = require('../services/workerService');

async function list(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const workers = await workerService.listWorkers({ limit, offset });
    res.json({ workers, limit, offset });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    const worker = await workerService.addWorker({
      fullName: req.body.fullName.trim(), phone: req.body.phone.trim().replace(/\s+/g, ''),
      temporaryPassword: req.body.temporaryPassword, addedBy: req.user.id, ip: req.ip,
    });
    res.status(201).json(worker);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone number already in use' });
    next(err);
  }
}

async function setStatus(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    const result = await workerService.setWorkerStatus({ workerId: req.params.id, status: req.body.status, changedBy: req.user.id, ip: req.ip });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function resetPassword(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    await workerService.resetWorkerPassword({ workerId: req.params.id, temporaryPassword: req.body.temporaryPassword, resetBy: req.user.id, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { list, create, setStatus, resetPassword };
