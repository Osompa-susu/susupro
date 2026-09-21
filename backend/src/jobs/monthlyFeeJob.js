const { runMonthlyFeeJob } = require('../services/monthlyFeeService');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

// No extra scheduling dependency needed. The job itself only ever
// looks at "last calendar month" (via SQL date_trunc against now()),
// so it doesn't need to fire at any exact moment — running it any
// time after a month rolls over correctly picks that month up, and
// running it again later in the same month is a safe no-op
// (ON CONFLICT DO NOTHING, and already-charged fees are skipped).
//
// That matters because Render's free-tier web service can go to sleep
// from inactivity: the very first request that wakes it back up
// triggers this to run again almost immediately (the short startup
// delay below), so a sleep spanning the 1st of the month self-corrects
// the next time anyone uses the app, instead of silently missing that
// month forever.
function startMonthlyFeeScheduler() {
  const tick = async () => {
    try {
      const result = await runMonthlyFeeJob();
      const didSomething = result.newlyOwing > 0 || result.results.some((r) => r.charged);
      if (didSomething) {
        console.log('[monthly-fee-job]', JSON.stringify(result));
      }
    } catch (err) {
      console.error('[monthly-fee-job] run failed', err);
    }
  };

  setTimeout(tick, 30 * 1000); // shortly after startup/wake-up
  setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { startMonthlyFeeScheduler };
