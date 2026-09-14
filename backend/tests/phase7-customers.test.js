process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const request = require('supertest');
const app = require('../src/app');
const { pool, truncateAll, seedUser } = require('./testHelpers');

afterAll(() => pool.end());

async function loginAs(user) {
  const res = await request(app).post('/api/auth/login').send({ phone: user.phone, password: user.password });
  return res.body.token;
}

describe('Phase 7 — Customer Management', () => {
  let worker, token;

  beforeEach(async () => {
    await truncateAll();
    worker = await seedUser({ phone: '0240000201', role: 'worker' });
    token = await loginAs(worker);
  });

  test('full registration flow: validate -> create customer -> create account -> generate ID -> audit event', async () => {
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ fullName: 'Ama Mensah', phone: '0209990001', community: 'Madina' });
    expect(res.status).toBe(201);
    expect(res.body.customer_code).toMatch(/^SUS-\d{6}$/);

    const audit = await pool.query(`SELECT * FROM audit_logs WHERE action = 'CUSTOMER_REGISTERED'`);
    expect(audit.rows.length).toBe(1);

    const account = await pool.query(`SELECT * FROM accounts WHERE customer_id = (SELECT id FROM customers WHERE customer_code = $1)`, [res.body.customer_code]);
    expect(account.rows.length).toBe(1);
  });

  test('duplicate phone number is rejected, not silently overwritten', async () => {
    await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ fullName: 'Ama Mensah', phone: '0209990002' });
    const dup = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ fullName: 'Different Name', phone: '0209990002' });
    expect(dup.status).toBe(409);
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM customers WHERE phone = '0209990002'`);
    expect(count.rows[0].n).toBe(1);
  });

  test('customer IDs are unique under concurrent registration', async () => {
    const attempts = Array.from({ length: 8 }, (_, i) =>
      request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ fullName: `Concurrent ${i}`, phone: `021888${1000 + i}` })
    );
    const results = await Promise.all(attempts);
    const codes = results.map(r => r.body.customer_code);
    expect(new Set(codes).size).toBe(8);
  });

  test('invalid input is rejected before touching the database', async () => {
    const res = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ fullName: 'A', phone: '123' });
    expect(res.status).toBe(400);
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM customers`);
    expect(count.rows[0].n).toBe(0);
  });

  test('search by ID, phone, and name all work', async () => {
    const reg = await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ fullName: 'Findable Person', phone: '0277001122' });
    const byId = await request(app).get(`/api/customers/search?q=${reg.body.customer_code}`).set('Authorization', `Bearer ${token}`);
    const byPhone = await request(app).get('/api/customers/search?q=0277001122').set('Authorization', `Bearer ${token}`);
    const byName = await request(app).get('/api/customers/search?q=Findable').set('Authorization', `Bearer ${token}`);
    expect(byId.body.results.length).toBe(1);
    expect(byPhone.body.results.length).toBe(1);
    expect(byName.body.results.length).toBe(1);
  });

  test('search results do not include full transaction history (thin projection)', async () => {
    await request(app).post('/api/customers').set('Authorization', `Bearer ${token}`).send({ fullName: 'Privacy Test', phone: '0277003344' });
    const res = await request(app).get('/api/customers/search?q=Privacy').set('Authorization', `Bearer ${token}`);
    expect(res.body.results[0]).not.toHaveProperty('history');
  });

  test('an unauthenticated request cannot register a customer', async () => {
    const res = await request(app).post('/api/customers').send({ fullName: 'Nope', phone: '0277009999' });
    expect(res.status).toBe(401);
  });

  test('a malformed customer code in the URL returns 404-equivalent, not a raw validation error', async () => {
    const res = await request(app).get('/api/customers/not-a-real-code').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Customer not found'); // no format hint leaked
  });
});
