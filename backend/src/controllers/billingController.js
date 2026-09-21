const monthlyFeeService = require('../services/monthlyFeeService');

async function runMonthlyFees(req, res, next) {
  try {
    const result = await monthlyFeeService.runMonthlyFeeJob();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { runMonthlyFees };
