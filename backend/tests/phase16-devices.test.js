process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const request = require('supertest');
const app = require('../src/app');
const { pool, truncateAll, seedUser } = require('./testHelpers');

afterAll(() => pool.end());

async function loginAs(user, deviceCode) {
  const res = await request(app).post('/api/auth/login').send({ phone: user.phone, password: user.password, deviceCode });
  return res.body;
}

describe('Phase 16 — Worker PWA & Android Tablet (device management)', () => {
  let admin, worker, adminToken;

  beforeEach(async () => {
    await truncateAll();
    admin = await seedUser({ phone: '0240000701', role: 'admin' });
    worker = await seedUser({ phone: '0240000702', role: 'worker' });
    adminToken = (await loginAs(admin)).token;
  });

  test('a worker cannot manage devices (admin-only)', async () => {
    const workerLogin = await loginAs(worker);
    const res = await request(app).get('/api/devices').set('Authorization', `Bearer ${workerLogin.token}`);
    expect(res.status).toBe(403);
  });

  test('registering a device and logging in with its code ties the session to it', async () => {
    await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken}`).send({ deviceCode: 'TAB-001', label: "Kofi's tablet" });
    const login = await loginAs(worker, 'TAB-001');
    expect(login.token).toBeTruthy();
    const session = await pool.query(`SELECT device_id FROM sessions WHERE user_id = $1`, [worker.id]);
    expect(session.rows[0].device_id).not.toBeNull();
  });

  test('login with an unrecognized device code still succeeds (falls back to untracked)', async () => {
    const login = await loginAs(worker, 'TAB-DOES-NOT-EXIST');
    expect(login.token).toBeTruthy();
    expect(login.deviceWarning).toMatch(/unrecognized/i);
  });

  test('login is rejected from a deactivated device', async () => {
    const dev = await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken}`).send({ deviceCode: 'TAB-002' });
    await request(app).patch(`/api/devices/${dev.body.id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'deactivated' });
    const login = await request(app).post('/api/auth/login').send({ phone: worker.phone, password: worker.password, deviceCode: 'TAB-002' });
    expect(login.status).toBe(403);
  });

  test('deactivating a device revokes ONLY that device\'s sessions, not the worker\'s other sessions', async () => {
    await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken}`).send({ deviceCode: 'TAB-003' });
    await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken}`).send({ deviceCode: 'TAB-004' });

    const sessionOnDeviceA = await loginAs(worker, 'TAB-003');
    const sessionOnDeviceB = await loginAs(worker, 'TAB-004');
    const browserSession = await loginAs(worker); // no device at all

    const devARow = await pool.query(`SELECT id FROM devices WHERE device_code = 'TAB-003'`);
    await request(app).patch(`/api/devices/${devARow.rows[0].id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'deactivated' });

    const stillA = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${sessionOnDeviceA.token}`);
    const stillB = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${sessionOnDeviceB.token}`);
    const stillBrowser = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${browserSession.token}`);

    expect(stillA.status).toBe(401); // revoked — this was the deactivated device
    expect(stillB.status).toBe(200); // untouched — a different device
    expect(stillBrowser.status).toBe(200); // untouched — no device at all
  });

  test('duplicate device codes are rejected', async () => {
    await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken}`).send({ deviceCode: 'TAB-DUP' });
    const dup = await request(app).post('/api/devices').set('Authorization', `Bearer ${adminToken}`).send({ deviceCode: 'TAB-DUP' });
    expect(dup.status).toBe(409);
  });
});
