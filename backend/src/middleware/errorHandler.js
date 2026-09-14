const env = require('../config/env');

// Every route in every later phase relies on this being the LAST
// middleware registered in app.js. It is the one and only place a
// response error body is constructed — no route should ever hand-roll
// its own 500 response.
function errorHandler(err, req, res, next) {
  // Full detail goes to the server log only.
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);

  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const body = { error: status === 500 ? 'Internal server error' : err.message || 'Request failed' };

  // Even in development, we don't echo raw driver/stack details into
  // the JSON body — a developer can read the server console instead.
  if (env.NODE_ENV !== 'production' && status === 500) {
    body.debugHint = 'See server logs for the full stack trace.';
  }

  res.status(status).json(body);
}

module.exports = { errorHandler };
