// Phase 1: centralizes environment variable access so nothing later
// reads process.env directly and scatters "what variables does this
// app actually need" across the codebase. Fails loudly and immediately
// if a required variable is missing, rather than letting a later
// phase discover it as a mysterious runtime bug.
require('dotenv').config();

const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN'];

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 4000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

if (env.NODE_ENV === 'production') {
  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for production: ${missing.join(', ')}`);
  }
}

module.exports = env;
