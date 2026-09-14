const securityService = require('../services/securityService');

async function summary(req, res, next) {
  try { res.json(await securityService.summary()); } catch (err) { next(err); }
}

module.exports = { summary };
