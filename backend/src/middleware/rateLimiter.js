const rateLimit = require('express-rate-limit');

// Bypass custom rate limits when running under Jest — otherwise a full
// test run (dozens of logins from the same IP across 61+ tests)
// exhausts real production limits partway through, failing unrelated
// tests with 429s instead of their actual expected result.
// JEST_WORKER_ID is set automatically by Jest, so this needs no
// manual flag. Found and fixed during the first real test execution
// of this project against a live database.
const skipInTests = () => !!process.env.JEST_WORKER_ID;

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
  skip: skipInTests,
});

// mfaLimiter deliberately does NOT skip in tests — it has its own
// dedicated test (mfa.test.js) that verifies it actually fires. The
// login/api limiters skip because dozens of unrelated tests log in
// repeatedly and would otherwise fail on an unrelated 429; the MFA
// endpoints are hit intensively by only one test file, whose own
// brute-force test is ordered LAST specifically so it can safely
// exhaust the quota without affecting the legitimate-flow tests
// earlier in the same file.
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many MFA attempts. Try again later.' },
});

module.exports = { apiLimiter, loginLimiter, mfaLimiter };
