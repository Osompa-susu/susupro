const { validationResult } = require('express-validator');
const ledgerService = require('../services/ledgerService');

async function request(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    const result = await ledgerService.requestWithdrawal({
      customerCode: req.body.customerCode, amount: req.body.amount, requestedBy: req.user.id, ip: req.ip,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function decide(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    const result = await ledgerService.decideWithdrawal({
      requestId: req.params.id, decision: req.body.decision, reason: req.body.reason, decidedBy: req.user.id, ip: req.ip,
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function list(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    res.json(await ledgerService.listWithdrawals({ status: req.query.status }));
  } catch (err) { next(err); }
}

module.exports = { request, decide, list };
