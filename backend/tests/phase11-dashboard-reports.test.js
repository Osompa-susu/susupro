process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const request = require('supertest');
const { randomUUID } = require('crypto');
const app = require('../src/app');
const { pool, truncateAll, seedUser } = require('./testHelpers');

afterAll(() => pool.end());

async function loginAs(user) {
  const res = await request(app).post('/api/auth/login').send({ phone: user.phone, password: user.password });
  return res.body.token;
}

describe('Phase 11 — Admin Dashboard & Reports', () => {
  let worker, admin, workerToken, adminToken, customerCode;

  beforeEach(async () => {
    await truncateAll();
    worker = await seedUser({ phone: '0240000601', role: 'worker' });
    admin = await seedUser({ phone: '0240000602', role: 'admin' });
    workerToken = await loginAs(worker);
    adminToken = await loginAs(admin);
    const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${workerToken}`).send({ fullName: 'Report Test Customer', phone: '0271119999' });
    customerCode = reg.body.customer_code;
  });

  test('a worker cannot access any report endpoint', async () => {
    const res = await request(app).get('/api/reports/dashboard').set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('dashboard totals match the raw ledger exactly (never a fake/cached value)', async () => {
    await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 100, idempotencyKey: randomUUID() });
    await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 50, idempotencyKey: randomUUID() });

    const dashboard = await request(app).get('/api/reports/dashboard').set('Authorization', `Bearer ${adminToken}`);
    const manualSum = await pool.query(`SELECT COALESCE(SUM(balance),0) AS total FROM account_balances`);

    expect(dashboard.status).toBe(200);
    expect(Number(dashboard.body.totalSavings)).toBe(Number(manualSum.rows[0].total));
    expect(Number(dashboard.body.totalSavings)).toBe(150);
    expect(dashboard.body.totalCustomers).toBe(1);
  });

  test('worker collection report correctly attributes deposits to the recording worker', async () => {
    await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 75, idempotencyKey: randomUUID() });
    const res = await request(app).get('/api/reports/by-worker').set('Authorization', `Bearer ${adminToken}`);
    const row = res.body.find(w => w.worker_id === worker.id);
    expect(Number(row.total_collected)).toBe(75);
  });

  test('a worker with zero deposits still appears in the worker report with 0, not omitted', async () => {
    await seedUser({ phone: '0240000603', role: 'worker' });
    const res = await request(app).get('/api/reports/by-worker').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.every(w => w.total_collected !== null)).toBe(true);
  });

  test('transaction report pagination never returns more than the requested limit', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 10, idempotencyKey: randomUUID() });
    }
    const res = await request(app).get('/api/reports/transactions?limit=2').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.results.length).toBe(2);
  });

  test('customer statement 404s cleanly for a nonexistent customer', async () => {
    const res = await request(app).get('/api/reports/customer/SUS-999999').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
