process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const request = require('supertest');
const app = require('../src/app');
const { pool, truncateAll, seedUser } = require('./testHelpers');
const { generateTOTP } = require('../src/utils/totp');

afterAll(() => pool.end());

async function loginAs(user, totpCode) {
  return request(app).post('/api/auth/login').send({ phone: user.phone, password: user.password, totpCode });
}

describe('MFA (Priority 3 verification)', () => {
  let admin;

  beforeEach(async () => {
    await truncateAll();
    admin = await seedUser({ phone: '0240000801', role: 'admin' });
  });

  test('setup -> confirm -> MFA becomes required on next login (successful MFA)', async () => {
    const login1 = await loginAs(admin);
    const token = login1.body.token;

    const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${token}`);
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toBeTruthy();

    const code = generateTOTP(setup.body.secret);
    const confirm = await request(app).post('/api/auth/mfa/confirm').set('Authorization', `Bearer ${token}`).send({ totpCode: code });
    expect(confirm.status).toBe(200);

    // Next login: password alone is no longer enough.
    const loginNoCode = await request(app).post('/api/auth/login').send({ phone: admin.phone, password: admin.password });
    expect(loginNoCode.status).toBe(401);
    expect(loginNoCode.body.code).toBe('MFA_REQUIRED');

    // Missing MFA case, explicitly: an entirely absent totpCode field behaves identically.
    const loginEmptyCode = await request(app).post('/api/auth/login').send({ phone: admin.phone, password: admin.password, totpCode: '' });
    expect([400, 401]).toContain(loginEmptyCode.status); // '' fails the 6-digit format validator -> 400, which is also correct

    // Successful MFA: correct password + correct current code.
    const validCode = generateTOTP(setup.body.secret);
    const loginWithCode = await loginAs({ phone: admin.phone, password: admin.password }, validCode);
    expect(loginWithCode.status).toBe(200);
    expect(loginWithCode.body.token).toBeTruthy();
  });

  test('incorrect MFA code is rejected and does not issue a session', async () => {
    const login1 = await loginAs(admin);
    const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${login1.body.token}`);
    const code = generateTOTP(setup.body.secret);
    await request(app).post('/api/auth/mfa/confirm').set('Authorization', `Bearer ${login1.body.token}`).send({ totpCode: code });

    const wrongCode = code === '000000' ? '111111' : '000000';
    const res = await loginAs({ phone: admin.phone, password: admin.password }, wrongCode);
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();

    const sessionCount = await pool.query(`SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = $1`, [admin.id]);
    expect(sessionCount.rows[0].n).toBe(1); // only the original pre-MFA session, no session created for the failed attempt
  });

  test('a disabled/never-enabled MFA account logs in with just phone+password (baseline, unaffected)', async () => {
    const res = await loginAs(admin);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('disabling MFA requires both the current password AND a valid code', async () => {
    const login1 = await loginAs(admin);
    const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${login1.body.token}`);
    const code = generateTOTP(setup.body.secret);
    await request(app).post('/api/auth/mfa/confirm').set('Authorization', `Bearer ${login1.body.token}`).send({ totpCode: code });

    const loginWithMfa = await loginAs({ phone: admin.phone, password: admin.password }, generateTOTP(setup.body.secret));
    const token = loginWithMfa.body.token;

    const wrongPassword = await request(app).post('/api/auth/mfa/disable').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'wrong', totpCode: generateTOTP(setup.body.secret) });
    expect(wrongPassword.status).toBe(401);

    const wrongCode = await request(app).post('/api/auth/mfa/disable').set('Authorization', `Bearer ${token}`).send({ currentPassword: admin.password, totpCode: '000000' });
    expect(wrongCode.status).toBe(401);

    const correct = await request(app).post('/api/auth/mfa/disable').set('Authorization', `Bearer ${token}`).send({ currentPassword: admin.password, totpCode: generateTOTP(setup.body.secret) });
    expect(correct.status).toBe(200);

    // Now logs in without a code again.
    const afterDisable = await loginAs(admin);
    expect(afterDisable.status).toBe(200);
  });

  test('session behavior: an existing session survives enabling MFA (not force-logged-out mid-setup)', async () => {
    const login1 = await loginAs(admin);
    const token = login1.body.token;
    const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${token}`);
    await request(app).post('/api/auth/mfa/confirm').set('Authorization', `Bearer ${token}`).send({ totpCode: generateTOTP(setup.body.secret) });
    const stillWorks = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(stillWorks.status).toBe(200); // the session used to SET UP mfa isn't itself invalidated by enabling it
  });

  test('logout works identically whether or not MFA is enabled', async () => {
    const login1 = await loginAs(admin);
    const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${login1.body.token}`);
    await request(app).post('/api/auth/mfa/confirm').set('Authorization', `Bearer ${login1.body.token}`).send({ totpCode: generateTOTP(setup.body.secret) });
    const loginWithMfa = await loginAs({ phone: admin.phone, password: admin.password }, generateTOTP(setup.body.secret));
    const logout = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${loginWithMfa.body.token}`);
    expect(logout.status).toBe(200);
    const after = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${loginWithMfa.body.token}`);
    expect(after.status).toBe(401);
  });

  test('password change does not require re-entering MFA (current design) — noted as a conscious choice, not an oversight', async () => {
    const login1 = await loginAs(admin);
    const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${login1.body.token}`);
    await request(app).post('/api/auth/mfa/confirm').set('Authorization', `Bearer ${login1.body.token}`).send({ totpCode: generateTOTP(setup.body.secret) });
    const loginWithMfa = await loginAs({ phone: admin.phone, password: admin.password }, generateTOTP(setup.body.secret));
    const change = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${loginWithMfa.body.token}`).send({ currentPassword: admin.password, newPassword: 'NewPassword1234!' });
    expect(change.status).toBe(200);
    // MFA remains enabled after a password change — verified by requiring a code on the next login.
    const loginAfter = await request(app).post('/api/auth/login').send({ phone: admin.phone, password: 'NewPassword1234!' });
    expect(loginAfter.body.code).toBe('MFA_REQUIRED');
  });

  test('account recovery: a second admin can reset a locked-out admin\'s MFA', async () => {
    const secondAdmin = await seedUser({ phone: '0240000802', role: 'admin' });
    const secondAdminLogin = await loginAs(secondAdmin);

    const login1 = await loginAs(admin);
    const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${login1.body.token}`);
    await request(app).post('/api/auth/mfa/confirm').set('Authorization', `Bearer ${login1.body.token}`).send({ totpCode: generateTOTP(setup.body.secret) });

    // admin has now "lost their device" — cannot produce a valid code.
    const reset = await request(app).post(`/api/auth/mfa/reset/${admin.id}`).set('Authorization', `Bearer ${secondAdminLogin.body.token}`);
    expect(reset.status).toBe(200);

    const loginAfterReset = await loginAs(admin); // no code needed anymore
    expect(loginAfterReset.status).toBe(200);
  });

  test('account recovery: a worker cannot reset an admin\'s MFA (admin-only recovery path)', async () => {
    const worker = await seedUser({ phone: '0240000803', role: 'worker' });
    const workerLogin = await loginAs(worker);
    const res = await request(app).post(`/api/auth/mfa/reset/${admin.id}`).set('Authorization', `Bearer ${workerLogin.body.token}`);
    expect(res.status).toBe(403);
  });

  // Deliberately the LAST test in this file: it intentionally exhausts
  // the MFA rate limiter's quota (10 requests/15min), which would
  // otherwise cause every legitimate MFA test above it to fail with an
  // unrelated 429 if it ran earlier in the file. Found via real
  // execution — an earlier version of this test ran third and broke
  // the ones that followed it.
  test('MFA endpoints are rate-limited against brute-forcing the 6-digit code', async () => {
    const login1 = await loginAs(admin);
    const setup = await request(app).post('/api/auth/mfa/setup').set('Authorization', `Bearer ${login1.body.token}`);
    const attempts = [];
    for (let i = 0; i < 12; i++) {
      attempts.push(request(app).post('/api/auth/mfa/confirm').set('Authorization', `Bearer ${login1.body.token}`).send({ totpCode: '000000' }));
    }
    const results = await Promise.all(attempts);
    expect(results.some(r => r.status === 429)).toBe(true); // the limiter kicks in before all 12 are allowed through
  });
});
