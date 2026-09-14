const { validationResult } = require('express-validator');
const ledgerService = require('../services/ledgerService');

async function deposit(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    const result = await ledgerService.deposit({
      customerCode: req.body.customerCode, amount: req.body.amount,
      performedBy: req.user.id, idempotencyKey: req.body.idempotencyKey, ip: req.ip,
    });
    res.status(result.deduplicated ? 200 : 201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

// Deliberately scoped to req.user.id server-side — never accepts a
// userId from the client, so a worker can never pull another worker's
// numbers by changing a query param.
async function mine(req, res, next) {
  try {
    const [stats, myWithdrawalRequests] = await Promise.all([
      ledgerService.myRecentTransactions(req.user.id),
      ledgerService.myWithdrawalRequests(req.user.id),
    ]);
    res.json({ ...stats, myWithdrawalRequests });
  } catch (err) { next(err); }
}

async function correct(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    const result = await ledgerService.correct({
      originalTransactionCode: req.body.originalTransactionCode, correctedAmount: req.body.correctedAmount,
      reason: req.body.reason, performedBy: req.user.id, ip: req.ip,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { deposit, mine, correct };
