const app = require('./app');
const env = require('./config/env');
const { startMonthlyFeeScheduler } = require('./jobs/monthlyFeeJob');

app.listen(env.PORT, () => {
  console.log(`SusuPro backend (Phase 1 foundation) listening on :${env.PORT}`);
  startMonthlyFeeScheduler();
});
