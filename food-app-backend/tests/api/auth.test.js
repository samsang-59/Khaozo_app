import { jest } from '@jest/globals';
import { googlePayload, refreshCookieFrom } from '../helpers/auth.js';

// ---- Mock Google (no network). verifyIdToken returns whatever the test sets.
let nextPayload = googlePayload();
let verifyShouldFail = false;
const verifyIdToken = jest.fn(async ({ audience }) => {
  if (verifyShouldFail) throw new Error('Wrong number of segments');
  return { getPayload: () => ({ ...nextPayload, aud: audience }) };
});
jest.unstable_mockModule('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));

const { default: request } = await import('supertest');
const { createApp } = await import('../../src/app.js');
const { pool } = await import('../../src/config/db.js');
const { env } = await import('../../src/config/env.js');
const { closeConnections } = await import('../helpers/connections.js');
const { resetData } = await import('../helpers/db.js');

const app = createApp();

beforeEach(async () => {
  await resetData();
  nextPayload = googlePayload();
  verifyShouldFail = false;
  verifyIdToken.mockClear();
});
afterAll(closeConnections);

const login = () => request(app).post('/api/v1/auth/google').send({ idToken: 'fake-google-id-token' });
const refresh = (cookie) => request(app).post('/api/v1/auth/refresh').set('Cookie', cookie ?? '');
const sessions = async () => (await pool.query('SELECT * FROM login_sessions ORDER BY id')).rows;

describe('POST /auth/google', () => {
  test('verifies the token for our client ID', async () => {
    await login();
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'fake-google-id-token', audience: env.googleClientId });
  });

  test('first login creates the user + an empty taste profile', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      isNewUser: true,
      user: { name: 'Sangram', email: 'sangram@example.com', role: 'user', journalVisibility: 'private' },
      accessToken: expect.any(String),
    });
    expect(res.body.data.refreshToken).toBeUndefined(); // only in the cookie

    const { rows } = await pool.query('SELECT tp.* FROM taste_profiles tp JOIN users u ON u.id = tp.user_id WHERE u.google_id = $1', ['google-123']);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ quiz_done: false, diet: null, spice_locked: false, ratings_used: 0 });
  });

  test('second login reuses the same user', async () => {
    const first = await login();
    const second = await login();
    expect(second.body.data.isNewUser).toBe(false);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM users');
    expect(rows[0].n).toBe(1);
    expect(await sessions()).toHaveLength(2); // one per device / login
  });

  test('sets the refresh cookie: httpOnly, SameSite=Strict, path /api/v1/auth, ~7 days', async () => {
    const res = await login();
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('refresh_token='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    const expires = new Date(cookie.match(/Expires=([^;]+)/)[1]);
    const days = (expires - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  test('stores only a SHA-256 hash of the refresh token', async () => {
    const res = await login();
    const token = refreshCookieFrom(res).split('=')[1];
    const [session] = await sessions();
    expect(session.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(session.token_hash).not.toBe(token);
  });

  test('invalid Google token → 401 GOOGLE_TOKEN_INVALID, nothing created', async () => {
    verifyShouldFail = true;
    const res = await login();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('GOOGLE_TOKEN_INVALID');
    expect((await pool.query('SELECT COUNT(*) AS n FROM users')).rows[0].n).toBe(0);
  });

  test('unverified Google email → 401', async () => {
    nextPayload = googlePayload({ email_verified: false });
    expect((await login()).status).toBe(401);
  });

  test('missing idToken → 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/v1/auth/google').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('body.idToken');
  });
});

describe('POST /auth/refresh', () => {
  test('rotates: new tokens, old session marked used (replaced_by)', async () => {
    const cookie = refreshCookieFrom(await login());
    const res = await refresh(cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    const newCookie = refreshCookieFrom(res);
    expect(newCookie).not.toBe(cookie);

    const [oldSession, newSession] = await sessions();
    expect(oldSession.replaced_by).toBe(newSession.id);
    expect(newSession.replaced_by).toBeNull();

    // the new cookie works
    expect((await refresh(newCookie)).status).toBe(200);
  });

  test('reuse within 10 s of rotation → plain 401, no mass revoke (parallel requests)', async () => {
    const cookie = refreshCookieFrom(await login());
    const first = await refresh(cookie);
    const again = await refresh(cookie); // same old token, immediately
    expect(again.status).toBe(401);
    expect(again.body.error.code).toBe('SESSION_INVALID');
    expect((await sessions()).every((s) => s.revoked_at === null)).toBe(true);
    expect((await refresh(refreshCookieFrom(first))).status).toBe(200); // the real new token still works
  });

  test('reuse after 10 s → all sessions of the user revoked (theft)', async () => {
    const cookie = refreshCookieFrom(await login());
    await login(); // a second device
    await refresh(cookie);
    // pretend the rotation happened a minute ago
    await pool.query(`UPDATE login_sessions SET created_at = now() - interval '1 minute' WHERE id = (SELECT max(id) FROM login_sessions)`);

    const res = await refresh(cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_REUSED');
    expect((await sessions()).every((s) => s.revoked_at !== null)).toBe(true);
  });

  test('expired session → 401', async () => {
    const cookie = refreshCookieFrom(await login());
    await pool.query(`UPDATE login_sessions SET expires_at = now() - interval '1 second'`);
    expect((await refresh(cookie)).status).toBe(401);
  });

  test('revoked session → 401', async () => {
    const cookie = refreshCookieFrom(await login());
    await pool.query('UPDATE login_sessions SET revoked_at = now()');
    expect((await refresh(cookie)).status).toBe(401);
  });

  test('no cookie / unknown token → 401', async () => {
    expect((await refresh()).status).toBe(401);
    expect((await refresh('refresh_token=nonsense')).status).toBe(401);
  });

  test('role changes reach the new access token', async () => {
    const cookie = refreshCookieFrom(await login());
    await pool.query(`UPDATE users SET role = 'admin'`);
    const res = await refresh(cookie);
    expect(res.body.data.user.role).toBe('admin');
  });
});

describe('logout', () => {
  test('logout revokes only this device', async () => {
    const a = await login();
    const b = await login();
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${a.body.data.accessToken}`)
      .set('Cookie', refreshCookieFrom(a));
    expect(res.status).toBe(200);
    expect((await refresh(refreshCookieFrom(a))).status).toBe(401);
    expect((await refresh(refreshCookieFrom(b))).status).toBe(200);
  });

  test('logout-all revokes every device', async () => {
    const a = await login();
    const b = await login();
    const res = await request(app).post('/api/v1/auth/logout-all').set('Authorization', `Bearer ${a.body.data.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.revoked).toBe(2);
    expect((await refresh(refreshCookieFrom(a))).status).toBe(401);
    expect((await refresh(refreshCookieFrom(b))).status).toBe(401);
  });

  test('logout needs an access token', async () => {
    expect((await request(app).post('/api/v1/auth/logout')).status).toBe(401);
  });
});
