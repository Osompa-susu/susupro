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
async function setupCustomerWithBalance(workerToken, amount) {
  const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${workerToken}`).send({ fullName: 'Withdrawal Test Customer', phone: `02${Date.now().toString().slice(-9)}` });
  const customerCode = reg.body.customer_code;
  await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount, idempotencyKey: randomUUID() });
  return customerCode;
}

describe('Phase 9 — Withdrawals & Approvals', () => {
  let worker, admin, workerToken, adminToken;

  beforeEach(async () => {
    await truncateAll();
    worker = await seedUser({ phone: '0240000401', role: 'worker' });
    admin = await seedUser({ phone: '0240000402', role: 'admin' });
    workerToken = await loginAs(worker);
    adminToken = await loginAs(admin);
  });

  // -------------------------------------------------------------
  // Confirmed business rules (from the actual business owner, not
  // guessed): (1) workers can register customers unsupervised —
  // already covered by phase7-customers.test.js; (2) no maximum
  // deposit/withdrawal amount, but every account must always retain
  // a minimum balance of GHS 50. Tests below verify rule (2) directly.
  // -------------------------------------------------------------

  test('CONFIRMED RULE: a withdrawal that would leave less than GHS 50 is rejected', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 100);
    const res = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 60 }); // would leave 40
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/GHS 50\.00 must remain/i);
  });

  test('CONFIRMED RULE: a withdrawal leaving exactly GHS 50 is allowed (the floor is inclusive)', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 100);
    const res = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 50 }); // leaves exactly 50
    expect(res.status).toBe(201);
  });

  test('CONFIRMED RULE: an account already at the GHS 50 floor cannot withdraw anything at all', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 50);
    const res = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no withdrawal is currently possible/i);
  });

  test('worker cannot approve their own withdrawal request (unauthorized approval)', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 100);
    const reqRes = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 50 });
    const decide = await request(app).post(`/api/withdrawals/${reqRes.body.requestId}/decide`).set('Authorization', `Bearer ${workerToken}`).send({ decision: 'approve' });
    expect(decide.status).toBe(403);
  });

  test('insufficient balance is rejected at request time', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 50);
    const res = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 100 });
    expect(res.status).toBe(422);
  });

  test('withdrawal from an inactive account is blocked', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 100);
    await pool.query(`UPDATE accounts SET status = 'closed' WHERE id = (SELECT a.id FROM accounts a JOIN customers c ON c.id = a.customer_id WHERE c.customer_code = $1)`, [customerCode]);
    const res = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 10 });
    expect(res.status).toBe(422);
  });

  test('full approve workflow: pending -> approved -> ledger entry -> balance updated', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 100);
    const reqRes = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 40 }); // leaves 60, above the floor
    const decide = await request(app).post(`/api/withdrawals/${reqRes.body.requestId}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'approve' });
    expect(decide.status).toBe(200);
    const balance = await pool.query(
      `SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries le JOIN accounts a ON a.id = le.account_id JOIN customers c ON c.id = a.customer_id WHERE c.customer_code = $1`,
      [customerCode]
    );
    expect(Number(balance.rows[0].balance)).toBe(60);
  });

  test('rejection leaves the balance untouched', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 100);
    const reqRes = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 40 });
    await request(app).post(`/api/withdrawals/${reqRes.body.requestId}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'reject' });
    const balance = await pool.query(
      `SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries le JOIN accounts a ON a.id = le.account_id JOIN customers c ON c.id = a.customer_id WHERE c.customer_code = $1`,
      [customerCode]
    );
    expect(Number(balance.rows[0].balance)).toBe(100);
  });

  test('a request cannot be decided twice (duplicate approval)', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 100);
    const reqRes = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 40 });
    const first = await request(app).post(`/api/withdrawals/${reqRes.body.requestId}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'approve' });
    const second = await request(app).post(`/api/withdrawals/${reqRes.body.requestId}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'reject' });
    expect(first.status).toBe(200);
    expect(second.status).toBe(404);
  });

  test('concurrent double-approval attempts on the SAME request only complete once (race condition)', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 100);
    const reqRes = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 40 });
    const [a, b] = await Promise.all([
      request(app).post(`/api/withdrawals/${reqRes.body.requestId}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'approve' }),
      request(app).post(`/api/withdrawals/${reqRes.body.requestId}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'approve' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 404]);
    const ledgerCount = await pool.query(`SELECT COUNT(*)::int AS n FROM ledger_entries WHERE entry_type = 'withdrawal'`);
    expect(ledgerCount.rows[0].n).toBe(1);
  });

  test('concurrent approvals of TWO DIFFERENT requests on the same account never both succeed if it would overdraw or breach the GHS 50 floor', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 200);
    const reqA = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 100 }); // leaves 100, fine
    // Directly insert a second, equally-valid-looking request bypassing
    // the pending-total check, to specifically exercise the
    // approval-time race — the request-time check already prevents
    // this in the normal flow, but approval-time re-verification
    // (now including the GHS 50 floor) is the real backstop.
    const acctRow = await pool.query(`SELECT a.id FROM accounts a JOIN customers c ON c.id = a.customer_id WHERE c.customer_code = $1`, [customerCode]);
    const reqBRow = await pool.query(`INSERT INTO withdrawal_requests (account_id, amount, requested_by) VALUES ($1, 100, $2) RETURNING id`, [acctRow.rows[0].id, worker.id]);

    const [a, b] = await Promise.all([
      request(app).post(`/api/withdrawals/${reqA.body.requestId}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'approve' }),
      request(app).post(`/api/withdrawals/${reqBRow.rows[0].id}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'approve' }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 422]); // one wins, one is cleanly rejected — never both
    const balance = await pool.query(`SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries WHERE account_id = $1`, [acctRow.rows[0].id]);
    expect(Number(balance.rows[0].balance)).toBeGreaterThanOrEqual(50); // the floor held even under a race
  });

  test('balance dropping below the request amount between request and approval blocks the approval', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 100);
    const req1 = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 40 });
    // Simulate the balance genuinely dropping after the request was
    // made — e.g. an admin corrects an earlier deposit downward.
    const depositTxn = await pool.query(
      `SELECT transaction_code FROM ledger_entries WHERE account_id = (SELECT a.id FROM accounts a JOIN customers c ON c.id = a.customer_id WHERE c.customer_code = $1) AND entry_type = 'deposit' LIMIT 1`,
      [customerCode]
    );
    await request(app).post('/api/transactions/corrections').set('Authorization', `Bearer ${adminToken}`)
      .send({ originalTransactionCode: depositTxn.rows[0].transaction_code, correctedAmount: 30, reason: 'test: simulate balance drop' });
    const decide1 = await request(app).post(`/api/withdrawals/${req1.body.requestId}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'approve' });
    expect(decide1.status).toBe(422);
  });

  test('parameter tampering: submitting a decision value outside approve/reject is rejected', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 100);
    const reqRes = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 10 });
    const res = await request(app).post(`/api/withdrawals/${reqRes.body.requestId}/decide`).set('Authorization', `Bearer ${adminToken}`).send({ decision: 'DEFINITELY_APPROVE_THIS' });
    expect(res.status).toBe(400);
  });

  test('a second pending request that would exceed the available (post-floor) balance combined with an already-pending one is rejected at request time', async () => {
    const customerCode = await setupCustomerWithBalance(workerToken, 200);
    const first = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 100 }); // available = 200-50=150; 100 fits
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/withdrawals/request').set('Authorization', `Bearer ${workerToken}`).send({ customerCode, amount: 80 }); // 100+80=180 > 150
    expect(second.status).toBe(422);
    expect(second.body.error).toMatch(/already pending/i);
  });
});
