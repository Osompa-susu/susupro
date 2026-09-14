const { validationResult } = require('express-validator');
const customerService = require('../services/customerService');

async function register(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    const customer = await customerService.register({
      fullName: req.body.fullName.trim(), phone: req.body.phone.trim().replace(/\s+/g, ''),
      community: req.body.community, savingsPlan: req.body.savingsPlan,
      registeredBy: req.user.id, ip: req.ip,
    });
    res.status(201).json(customer);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function search(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const results = await customerService.search({ query: req.query.q, limit, offset });
    res.json({ results, limit, offset });
  } catch (err) { next(err); }
}

async function getByCode(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Customer not found' }); // malformed code -> same as not-found, no format hints leaked
  try {
    res.json(await customerService.getByCode(req.params.customerCode));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { register, search, getByCode };
