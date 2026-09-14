const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const accountRoutes = require('./routes/accounts');
const transactionRoutes = require('./routes/transactions');
const withdrawalRoutes = require('./routes/withdrawals');
const workerRoutes = require('./routes/workers');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audit');
const securityRoutes = require('./routes/security');
const deviceRoutes = require('./routes/devices');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(apiLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', phase: 5, service: 'susupro-backend' }));

// Phase 5: every router is mounted at its final path now, even though
// most handlers inside them return 501 until their named phase fills
// them in. This means the frontend's URLs never change between now
// and full implementation — only the response behind them does.
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/devices', deviceRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
