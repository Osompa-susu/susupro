const auditService = require('../services/auditService');

async function list(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 60, 500);
    res.json(await auditService.listAuditLogs({ limit }));
  } catch (err) { next(err); }
}

module.exports = { list };
