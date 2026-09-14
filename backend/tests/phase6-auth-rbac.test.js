process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const request = require('supertest');
const app = require('../src/app');
const { pool, truncateAll, seedUser } = require('./testHelpers');

afterAll(() => pool.end());

describe('Phase 6 — Authentication & RBAC', () => {
  beforeEach(truncateAll);

  test('valid login returns a token', async () => {
    const worker = await seedUser({ phone: '0240000101', role: 'worker' });
    const res = await request(app).post('/api/auth/login').send({ phone: worker.phone, password: worker.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('invalid credentials rejected with an identical message either way (no user enumeration)', async () => {
    await seedUser({ phone: '0240000102', role: 'worker' });
    const wrongPassword = await request(app).post('/api/auth/login').send({ phone: '0240000102', password: 'wrongpass' });
    const noSuchUser = await request(app).post('/api/auth/login').send({ phone: '0240000199', password: 'wrongpass' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error).toBe(noSuchUser.body.error);
  });

  test('unauthenticated request to a protected route is rejected', async () => {
    const res = await request(app).get('/api/workers');
    expect(res.status).toBe(401);
  });

  test('EXPLICIT MASTER-PROMPT TEST: a worker cannot access admin APIs even by manually constructing the request', async () => {
    const worker = await seedUser({ phone: '0240000103', role: 'worker' });
    const login = await request(app).post('/api/auth/login').send({ phone: worker.phone, password: worker.password });
    // Manually constructed request to an admin-only endpoint, valid session, wrong role.
    const res = await request(app).get('/api/workers').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });

  test('admin CAN access an admin-only endpoint', async () => {
    const admin = await seedUser({ phone: '0240000104', role: 'admin' });
    const login = await request(app).post('/api/auth/login').send({ phone: admin.phone, password: admin.password });
    const res = await request(app).get('/api/workers').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
  });

  test('EXPLICIT MASTER-PROMPT TEST: session invalidation — logout revokes the token immediately', async () => {
    const admin = await seedUser({ phone: '0240000105', role: 'admin' });
    const login = await request(app).post('/api/auth/login').send({ phone: admin.phone, password: admin.password });
    const token = login.body.token;
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    const after = await request(app).get('/api/workers').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  test('EXPLICIT MASTER-PROMPT TEST: authentication bypass attempt — a forged/garbage token is rejected', async () => {
    const res = await request(app).get('/api/workers').set('Authorization', 'Bearer this.is.not.a.valid.jwt');
    expect(res.status).toBe(401);
  });

  test('expired session is rejected even with a structurally valid token', async () => {
    const admin = await seedUser({ phone: '0240000106', role: 'admin' });
    const login = await request(app).post('/api/auth/login').send({ phone: admin.phone, password: admin.password });
    await pool.query(`UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE user_id = $1`, [admin.id]);
    const res = await request(app).get('/api/workers').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(401);
  });

  test('repeated failed logins lock the account (brute-force protection)', async () => {
    const worker = await seedUser({ phone: '0240000107', role: 'worker' });
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ phone: worker.phone, password: 'wrongpass' });
    }
    const res = await request(app).post('/api/auth/login').send({ phone: worker.phone, password: worker.password });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/locked/i);
  });

  test('a deactivated worker cannot log in even with correct credentials', async () => {
    const worker = await seedUser({ phone: '0240000108', role: 'worker', status: 'deactivated' });
    const res = await request(app).post('/api/auth/login').send({ phone: worker.phone, password: worker.password });
    expect(res.status).toBe(403);
  });

  test('a forced password change blocks every route except change-password/logout', async () => {
    const worker = await seedUser({ phone: '0240000109', role: 'worker' });
    await pool.query(`UPDATE users SET force_password_change = true WHERE id = $1`, [worker.id]);
    const login = await request(app).post('/api/auth/login').send({ phone: worker.phone, password: worker.password });
    expect(login.body.forcePasswordChange).toBe(true);
    const blocked = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  test('changing password revokes other sessions', async () => {
    const admin = await seedUser({ phone: '0240000110', role: 'admin' });
    const sessionA = await request(app).post('/api/auth/login').send({ phone: admin.phone, password: admin.password });
    const sessionB = await request(app).post('/api/auth/login').send({ phone: admin.phone, password: admin.password });
    await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${sessionB.body.token}`).send({ currentPassword: admin.password, newPassword: 'NewPassword1234!' });
    const stillWorksB = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${sessionB.body.token}`);
    const revokedA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${sessionA.body.token}`);
    expect(stillWorksB.status).toBe(200); // the session that made the change survives
    expect(revokedA.status).toBe(401); // the other one does not
  });
});
