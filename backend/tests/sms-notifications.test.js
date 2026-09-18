process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Mock the SMS provider entirely — these tests must never make a real
// network call to a paid SMS gateway. Each test controls whether the
// mocked send "succeeds" or "fails" to exercise both real code paths.
jest.mock('../src/utils/smsService');
const { sendSms } = require('../src/utils/smsService');

const request = require('supertest');
const { randomUUID } = require('crypto');
const app = require('../src/app');
const { pool, truncateAll, seedUser } = require('./testHelpers');

afterAll(() => pool.end());
beforeEach(() => sendSms.mockReset());

async function loginAs(user) {
  const res = await request(app).post('/api/auth/login').send({ phone: user.phone, password: user.password });
  return res.body.token;
}

describe('SMS deposit notifications', () => {
  let worker, token;

  beforeEach(async () => {
    await truncateAll();
    worker = await seedUser({ phone: '0240000901', role: 'worker' });
    token = await loginAs(worker);
  });

  test('a customer who has NOT consented never gets an SMS or a fee, regardless of provider mock', async () => {
    const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'No Consent Customer', phone: '0271230001', smsNotificationsEnabled: false });
    const customerCode = reg.body.customer_code;

    const dep = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`)
      .send({ customerCode, amount: 100, idempotencyKey: randomUUID() });

    expect(dep.status).toBe(201);
    expect(Number(dep.body.newBalance)).toBe(100); // no fee deducted
    expect(sendSms).not.toHaveBeenCalled();

    const notifications = await pool.query(`SELECT COUNT(*)::int AS n FROM sms_notifications WHERE customer_id = (SELECT id FROM customers WHERE customer_code = $1)`, [customerCode]);
    expect(notifications.rows[0].n).toBe(0);
  });

  test('consent given + SMS send succeeds: fee is charged, one fee ledger row exists, notification logged as sent', async () => {
    sendSms.mockResolvedValue({ status: 'success', data: [{ id: 'mock-message-id' }] });

    const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Consenting Customer', phone: '0271230002', smsNotificationsEnabled: true });
    const customerCode = reg.body.customer_code;

    const dep = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`)
      .send({ customerCode, amount: 100, idempotencyKey: randomUUID() });
    expect(dep.status).toBe(201);

    // The deposit's own immediate response reflects the balance BEFORE
    // the async notification step runs (100), not after the fee —
    // confirm the fee lands by checking the actual final ledger state.
    const finalBalance = await pool.query(
      `SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries le JOIN accounts a ON a.id = le.account_id JOIN customers c ON c.id = a.customer_id WHERE c.customer_code = $1`,
      [customerCode]
    );
    expect(Number(finalBalance.rows[0].balance)).toBe(99.80); // 100 - GHS 0.20 fee

    const feeEntry = await pool.query(`SELECT COUNT(*)::int AS n FROM ledger_entries WHERE entry_type = 'fee'`);
    expect(feeEntry.rows[0].n).toBe(1);

    const notification = await pool.query(`SELECT status FROM sms_notifications WHERE customer_id = (SELECT id FROM customers WHERE customer_code = $1)`, [customerCode]);
    expect(notification.rows[0].status).toBe('sent');
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  test('consent given but SMS provider FAILS: no fee is charged, deposit is completely unaffected, failure is logged', async () => {
    sendSms.mockRejectedValue(Object.assign(new Error('provider unreachable'), { code: 'SMS_SEND_FAILED' }));

    const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Failed Send Customer', phone: '0271230003', smsNotificationsEnabled: true });
    const customerCode = reg.body.customer_code;

    const dep = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`)
      .send({ customerCode, amount: 100, idempotencyKey: randomUUID() });
    expect(dep.status).toBe(201); // the deposit itself must succeed regardless

    const finalBalance = await pool.query(
      `SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries le JOIN accounts a ON a.id = le.account_id JOIN customers c ON c.id = a.customer_id WHERE c.customer_code = $1`,
      [customerCode]
    );
    expect(Number(finalBalance.rows[0].balance)).toBe(100); // full amount, no fee — never charge for an undelivered message

    const feeEntry = await pool.query(`SELECT COUNT(*)::int AS n FROM ledger_entries WHERE entry_type = 'fee'`);
    expect(feeEntry.rows[0].n).toBe(0);

    const notification = await pool.query(`SELECT status FROM sms_notifications WHERE customer_id = (SELECT id FROM customers WHERE customer_code = $1)`, [customerCode]);
    expect(notification.rows[0].status).toBe('failed');
  });

  test('a deposit too small to cover the fee: notification skipped, deposit still succeeds in full', async () => {
    const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Tiny Deposit Customer', phone: '0271230004', smsNotificationsEnabled: true });
    const customerCode = reg.body.customer_code;

    // GHS 0.10 deposit -> new balance 0.10, below the GHS 0.20 fee.
    const dep = await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`)
      .send({ customerCode, amount: 0.10, idempotencyKey: randomUUID() });
    expect(dep.status).toBe(201);

    const finalBalance = await pool.query(
      `SELECT COALESCE(SUM(signed_amount),0) AS balance FROM ledger_entries le JOIN accounts a ON a.id = le.account_id JOIN customers c ON c.id = a.customer_id WHERE c.customer_code = $1`,
      [customerCode]
    );
    expect(Number(finalBalance.rows[0].balance)).toBe(0.10); // untouched — never forced negative for a fee it can't afford

    expect(sendSms).not.toHaveBeenCalled(); // never even attempted to send

    const notification = await pool.query(`SELECT status FROM sms_notifications WHERE customer_id = (SELECT id FROM customers WHERE customer_code = $1)`, [customerCode]);
    expect(notification.rows[0].status).toBe('skipped_insufficient_balance');
  });

  test('a deduplicated (idempotent retry) deposit never sends a second SMS or charges a second fee', async () => {
    sendSms.mockResolvedValue({ status: 'success', data: [{ id: 'mock-message-id' }] });

    const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Dedup Customer', phone: '0271230005', smsNotificationsEnabled: true });
    const customerCode = reg.body.customer_code;
    const key = randomUUID();

    await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 100, idempotencyKey: key });
    await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 100, idempotencyKey: key });

    expect(sendSms).toHaveBeenCalledTimes(1); // not 2 — the retry is recognized as the same transaction, no new notification attempt
    const feeCount = await pool.query(`SELECT COUNT(*)::int AS n FROM ledger_entries WHERE entry_type = 'fee'`);
    expect(feeCount.rows[0].n).toBe(1);
  });

  test('toggling consent after registration is respected on the NEXT deposit', async () => {
    sendSms.mockResolvedValue({ status: 'success', data: [{ id: 'mock-message-id' }] });

    const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Toggle Customer', phone: '0271230006', smsNotificationsEnabled: false });
    const customerCode = reg.body.customer_code;

    const enable = await request(app).patch(`/api/customers/${customerCode}/sms-notifications`).set('Authorization', `Bearer ${token}`).send({ enabled: true });
    expect(enable.status).toBe(200);
    expect(enable.body.sms_notifications_enabled).toBe(true);

    await request(app).post('/api/transactions/deposit').set('Authorization', `Bearer ${token}`).send({ customerCode, amount: 50, idempotencyKey: randomUUID() });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  test('registering with no smsNotificationsEnabled field at all defaults to false (never opt-in by default)', async () => {
    const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Default Customer', phone: '0271230007' }); // field omitted entirely
    const check = await pool.query(`SELECT sms_notifications_enabled FROM customers WHERE customer_code = $1`, [reg.body.customer_code]);
    expect(check.rows[0].sms_notifications_enabled).toBe(false);
  });
});
