const reportService = require('../services/reportService');

async function dashboard(req, res, next) {
  try { res.json(await reportService.dashboard()); } catch (err) { next(err); }
}
async function summary(req, res, next) {
  try { res.json(await reportService.summary({ from: req.query.from, to: req.query.to })); } catch (err) { next(err); }
}
async function byWorker(req, res, next) {
  try { res.json(await reportService.byWorker({ from: req.query.from, to: req.query.to, workerId: req.query.workerId })); } catch (err) { next(err); }
}
async function transactionsReport(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const results = await reportService.transactionsReport({ from: req.query.from, to: req.query.to, type: req.query.type, status: req.query.status, workerId: req.query.workerId, limit, offset });
    res.json({ results, limit, offset });
  } catch (err) { next(err); }
}
async function customerStatement(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    res.json(await reportService.customerStatement({ customerCode: req.params.customerCode, from: req.query.from, to: req.query.to, limit, offset }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { dashboard, summary, byWorker, transactionsReport, customerStatement };
