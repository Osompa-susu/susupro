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

describe('Phase 10 — Audit Logging & Corrections', () => {
  let worker, admin, workerToken, adminToken, customerCode;

  beforeEach(async () => {
    await truncateAll();
    worker = await seedUser({ phone: '0240000501', role: 'worker' });
    admin = await seedUser({ phone: '0240000502', role: 'admin' });
    workerToken = await loginAs(worker);
    adminToken = await loginAs(admin);
    const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${workerToken}`).send({ fullName: 'Correction Test Customer', phone: '0270005566' });
    customerCode = reg.body.customer_code;
  });

  test('worker cannot perform a correction (admin-only)', async () => {
    const dep = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 500, idempotencyKey: randomUUID() });
    const res = await request(app).post('/api/transactions/corrections').set('Authorization', `Bearer ${workerToken}`)
      .send({ originalTransactionCode: dep.body.transaction.transaction_code, correctedAmount: 50, reason: 'typo — meant 50' });
    expect(res.status).toBe(403);
  });

  test('correcting GHS 500 -> GHS 50 leaves the original untouched and nets to the right balance', async () => {
    const dep = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 500, idempotencyKey: randomUUID() });
    const originalCode = dep.body.transaction.transaction_code;
    const correction = await request(app).post('/api/transactions/corrections').set('Authorization', `Bearer ${adminToken}`)
      .send({ originalTransactionCode: originalCode, correctedAmount: 50, reason: 'worker mistyped the amount' });
    expect(correction.status).toBe(201);
    expect(Number(correction.body.delta)).toBe(-450);
    expect(Number(correction.body.newBalance)).toBe(50);
    const original = await pool.query(`SELECT signed_amount FROM ledger_entries WHERE transaction_code = $1`, [originalCode]);
    expect(Number(original.rows[0].signed_amount)).toBe(500);
  });

  test('a correction requires a reason', async () => {
    const dep = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 100, idempotencyKey: randomUUID() });
    const res = await request(app).post('/api/transactions/corrections').set('Authorization', `Bearer ${adminToken}`).send({ originalTransactionCode: dep.body.transaction.transaction_code, correctedAmount: 90 });
    expect(res.status).toBe(400);
  });

    test('a correction that would take the balance negative is rejected', async () => {
    const dep1 = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 100, idempotencyKey: randomUUID() });
    await request(app).post('/api/transactions/corrections').set('Authorization', `Bearer ${adminToken}`)
      .send({ originalTransactionCode: dep1.body.transaction.transaction_code, correctedAmount: 10, reason: 'test setup: bring balance down to 10' });
    const res = await request(app).post('/api/transactions/corrections').set('Authorization', `Bearer ${adminToken}`)
      .send({ originalTransactionCode: dep1.body.transaction.transaction_code, correctedAmount: -50, reason: 'retroactive correction attempt' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/negative/i);
  });

  test('DB-level: a completed ledger row cannot be UPDATEd or DELETEd directly', async () => {
    const dep = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 100, idempotencyKey: randomUUID() });
    await expect(pool.query(`UPDATE ledger_entries SET signed_amount = 999 WHERE transaction_code = $1`, [dep.body.transaction.transaction_code])).rejects.toThrow(/immutable/i);
    await expect(pool.query(`DELETE FROM ledger_entries WHERE transaction_code = $1`, [dep.body.transaction.transaction_code])).rejects.toThrow(/immutable/i);
  });

  test('DB-level: audit_logs is append-only', async () => {
    await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 100, idempotencyKey: randomUUID() });
    await expect(pool.query(`UPDATE audit_logs SET action = 'TAMPERED' WHERE action = 'DEPOSIT'`)).rejects.toThrow(/append-only/i);
    await expect(pool.query(`DELETE FROM audit_logs WHERE action = 'DEPOSIT'`)).rejects.toThrow(/append-only/i);
  });

  test('a worker cannot read the audit log (admin-only)', async () => {
    const res = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('every required action type from the master prompt is actually being audited', async () => {
    const dep = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 100, idempotencyKey: randomUUID() });
    const wreq = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 10 });
    await request(app).post(`/api/withdrawals/${wreq.body.requestId}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'reject' });
    await request(app).post('/api/transactions/corrections').set('Authorization', `Bearer ${adminToken}`).send({ originalTransactionCode: dep.body.transaction.transaction_code, correctedAmount: 90, reason: 'test correction' });
    await request(app).post('/api/workers').set('Authorization', `Bearer ${adminToken}`).send({ fullName: 'New Worker', phone: '0271112222', temporaryPassword: 'TempPass1234!' });
    await request(app).post('/api/auth/login').send({ phone: worker.phone, password: 'wrong' });

    const logs = await request(app).get('/api/audit-logs?limit=100').set('Authorization', `Bearer ${adminToken}`);
    const actions = logs.body.map(l => l.action);
    for (const expected of ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'CUSTOMER_REGISTERED', 'DEPOSIT', 'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_REJECTED', 'TRANSACTION_CORRECTED', 'WORKER_CREATED']) {
      expect(actions).toContain(expected);
    }
  });
});
