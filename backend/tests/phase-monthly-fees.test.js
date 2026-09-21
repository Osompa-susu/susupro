process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const request = require('supertest');
const app = require('../src/app');
const { pool, truncateAll, seedUser } = require('./testHelpers');
const { runMonthlyFeeJob, MONTHLY_FEE_AMOUNT } = require('../src/services/monthlyFeeService');

afterAll(() => pool.end());

async function loginAs(user) {
  const res = await request(app).post('/api/auth/login').send({ phone: user.phone, password: user.password });
  return res.body.token;
}
async function registerCustomer(token, phone) {
  const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ fullName: 'Monthly Fee Test Customer', phone });
  return res.body.customer_code;
}
async function accountIdFor(customerCode) {
  const { rows } = await pool.query(`SELECT a.id FROM accounts a JOIN customers c ON c.id = a.customer_id WHERE c.customer_code = $1`, [customerCode]);
  return rows[0].id;
}
// Inserts a deposit dated in a specific past month, bypassing the API
// (which always stamps created_at = now()) — the only way to exercise
// "last month's deposits" without waiting a real month.
async function backdatedDeposit(accountId, performedBy, amount, monthsAgo) {
  await pool.query(
    `INSERT INTO ledger_entries (account_id, entry_type, signed_amount, performed_by, status, created_at)
     VALUES ($1, 'deposit', $2, $3, 'completed', date_trunc('month', now() - ($4 || ' months')::interval) + interval '5 days')`,
    [accountId, amount, performedBy, monthsAgo]
  );
}

describe('Monthly susu collection fee', () => {
  let worker, token;

  beforeEach(async () => {
    await truncateAll();
    worker = await seedUser({ phone: '0240000401', role: 'worker' });
    token = await loginAs(worker);
  });

  test('a customer who deposited last month owes and gets charged GHS 10 at job run', async () => {
    const customerCode = await registerCustomer(token, '0270000401');
    const accountId = await accountIdFor(customerCode);
    await backdatedDeposit(accountId, worker.id, 100, 1); // last month, well above the GHS 50 floor

    const result = await runMonthlyFeeJob();
    expect(result.newlyOwing).toBe(1);
    expect(result.results.find((r) => r.accountId === accountId).charged).toBe(true);

    const { rows: balRows } = await pool.query(`SELECT balance FROM account_balances WHERE account_id = $1`, [accountId]);
    expect(Number(balRows[0].balance)).toBe(100 - MONTHLY_FEE_AMOUNT);
  });

  test('a customer who did not deposit last month owes nothing', async () => {
    const customerCode = await registerCustomer(token, '0270000402');
    const accountId = await accountIdFor(customerCode);
    await backdatedDeposit(accountId, worker.id, 100, 3); // three months ago, not last month

    const result = await runMonthlyFeeJob();
    expect(result.newlyOwing).toBe(0);

    const { rows } = await pool.query(`SELECT status FROM monthly_fees WHERE account_id = $1`, [accountId]);
    expect(rows.length).toBe(0);
  });

  test('running the job twice for the same month does not double-charge', async () => {
    const customerCode = await registerCustomer(token, '0270000403');
    const accountId = await accountIdFor(customerCode);
    await backdatedDeposit(accountId, worker.id, 100, 1);

    await runMonthlyFeeJob();
    await runMonthlyFeeJob(); // second run — should be a no-op for this account

    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ledger_entries WHERE entry_type = 'fee' AND account_id = $1`, [accountId]);
    expect(rows[0].n).toBe(1);
  });

  test('a fee that would breach the GHS 50 minimum is held as owed, not charged', async () => {
    const customerCode = await registerCustomer(token, '0270000404');
    const accountId = await accountIdFor(customerCode);
    await backdatedDeposit(accountId, worker.id, 55, 1); // 55 - 10 = 45, below the GHS 50 floor

    const result = await runMonthlyFeeJob();
    const outcome = result.results.find((r) => r.accountId === accountId);
    expect(outcome.charged).toBe(false);
    expect(outcome.reason).toBe('would_breach_minimum_balance');

    const { rows: balRows } = await pool.query(`SELECT balance FROM account_balances WHERE account_id = $1`, [accountId]);
    expect(Number(balRows[0].balance)).toBe(55); // untouched

    const { rows: feeRows } = await pool.query(`SELECT status FROM monthly_fees WHERE account_id = $1`, [accountId]);
    expect(feeRows[0].status).toBe('pending');
  });

  test('a held fee gets combined and charged once the balance allows it, on a later run', async () => {
    const customerCode = await registerCustomer(token, '0270000405');
    const accountId = await accountIdFor(customerCode);

    // Simulate month -2's fee already recorded as pending, as if an
    // earlier run found it unaffordable and left it owing.
    await pool.query(
      `INSERT INTO monthly_fees (account_id, fee_month, amount, status)
       VALUES ($1, date_trunc('month', now() - interval '2 months')::date, $2, 'pending')`,
      [accountId, MONTHLY_FEE_AMOUNT]
    );

    // A real deposit last month brings the balance up enough to cover both months together.
    await backdatedDeposit(accountId, worker.id, 75, 1); // owed will be 20 (two months); 75-20=55 >= 50

    const result = await runMonthlyFeeJob();
    const outcome = result.results.find((r) => r.accountId === accountId);
    expect(outcome.charged).toBe(true);
    expect(outcome.monthsCharged).toBe(2);
    expect(outcome.totalOwed).toBe(20);

    const { rows: balRows } = await pool.query(`SELECT balance FROM account_balances WHERE account_id = $1`, [accountId]);
    expect(Number(balRows[0].balance)).toBe(55);
  });

  test('the system billing user exists but cannot log in', async () => {
    await runMonthlyFeeJob(); // ensures the system user gets created
    const { rows } = await pool.query(`SELECT status FROM users WHERE staff_code = 'SYS-001'`);
    expect(rows[0].status).toBe('suspended');

    const res = await request(app).post('/api/auth/login').send({ phone: '000-000-0000-SYS', password: 'anything' });
    expect(res.status).not.toBe(200);
  });

  test('admin can trigger the job manually; a worker cannot', async () => {
    const admin = await seedUser({ phone: '0240000402', role: 'admin' });
    const adminToken = await loginAs(admin);

    const asWorker = await request(app).post('/api/billing/monthly-fees/run').set('Authorization', `Bearer ${token}`);
    expect(asWorker.status).toBe(403);

    const asAdmin = await request(app).post('/api/billing/monthly-fees/run').set('Authorization', `Bearer ${adminToken}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body).toHaveProperty('accountsProcessed');
  });
});
