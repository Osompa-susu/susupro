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
async function registerCustomer(token, phone = '0277002233') {
  const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ fullName: 'Deposit Test Customer', phone });
  return res.body.customer_code;
}

describe('Phase 8 — Financial Deposits', () => {
  let worker, token, customerCode;

  beforeEach(async () => {
    await truncateAll();
    worker = await seedUser({ phone: '0240000301', role: 'worker' });
    token = await loginAs(worker);
    customerCode = await registerCustomer(token);
  });

  test('a normal deposit updates the derived balance and creates one ledger row', async () => {
    const res = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 20, idempotencyKey: randomUUID() });
    expect(res.status).toBe(201);
    expect(Number(res.body.newBalance)).toBe(20);
    const rows = await pool.query(`SELECT COUNT(*)::int AS n FROM ledger_entries WHERE entry_type = 'deposit'`);
    expect(rows.rows[0].n).toBe(1);
  });

  test('rejects negative and zero amounts', async () => {
    const neg = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: -5, idempotencyKey: randomUUID() });
    const zero = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 0, idempotencyKey: randomUUID() });
    expect(neg.status).toBe(400);
    expect(zero.status).toBe(400);
  });

  test('rejects a deposit for a nonexistent customer', async () => {
    const res = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode: 'SUS-999999', amount: 10, idempotencyKey: randomUUID() });
    expect(res.status).toBe(404);
  });

  test('an unauthorized (unauthenticated) request cannot deposit', async () => {
    const res = await request(app).post('/api/transactions/deposit').send({ customerCode, amount: 10, idempotencyKey: randomUUID() });
    expect(res.status).toBe(401);
  });

  test('duplicate submission with the same idempotency key is deduplicated, not double-recorded', async () => {
    const key = randomUUID();
    const first = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 20, idempotencyKey: key });
    const retry = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 20, idempotencyKey: key });
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.deduplicated).toBe(true);
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM ledger_entries WHERE idempotency_key = $1`, [key]);
    expect(count.rows[0].n).toBe(1);
  });

  test('double-click (concurrent identical requests) still produces only one ledger row', async () => {
    const key = randomUUID();
    const [a, b] = await Promise.all([
      request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 20, idempotencyKey: key }),
      request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 20, idempotencyKey: key }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM ledger_entries WHERE idempotency_key = $1`, [key]);
    expect(count.rows[0].n).toBe(1);
  });

  test('concurrent deposits to the same account are ALL recorded (no lost updates / race condition)', async () => {
    const attempts = Array.from({ length: 5 }, () =>
      request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 10, idempotencyKey: randomUUID() })
    );
    await Promise.all(attempts);
    const balance = await pool.query(
      `SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries le
         JOIN accounts a ON a.id = le.account_id JOIN customers c ON c.id = a.customer_id
        WHERE c.customer_code = $1`,
      [customerCode]
    );
    expect(Number(balance.rows[0].balance)).toBe(50);
  });

  test('an inactive customer cannot receive a deposit (no partial database update)', async () => {
    await pool.query(`UPDATE customers SET status = 'inactive' WHERE customer_code = $1`, [customerCode]);
    await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 20, idempotencyKey: randomUUID() });
    const rows = await pool.query(`SELECT COUNT(*)::int AS n FROM ledger_entries`);
    expect(rows.rows[0].n).toBe(0);
  });

  test('a very large amount beyond the sanity ceiling is rejected', async () => {
    const res = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 5000000, idempotencyKey: randomUUID() });
    expect(res.status).toBe(400);
  });

  test('client-supplied balance/new-balance fields, if sent, are ignored — server computes the real value', async () => {
    const res = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`)
      .send({ customerCode, amount: 20, idempotencyKey: randomUUID(), newBalance: 999999, previousBalance: -500 });
    expect(res.status).toBe(201);
    expect(Number(res.body.newBalance)).toBe(20); // the real computed value, not the tampered one
  });
});
