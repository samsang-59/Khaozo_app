import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as configService from '../../src/services/helpers/config.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, resetCache, insertUser } from '../helpers/db.js';
import { accessTokenFor } from '../helpers/auth.js';

const app = createApp({ rateLimits: true });
let original;

beforeAll(async () => {
  await resetData();
  original = (await pool.query(`SELECT value FROM config_settings WHERE key = 'rate_limits'`)).rows[0].value;
  const tight = { ...original, api: { user: [3, 60], ip: [5, 60] }, auth: { ip: [2, 60] } };
  await pool.query(`UPDATE config_settings SET value = $1 WHERE key = 'rate_limits'`, [tight]);
});
beforeEach(async () => {
  await resetCache();
  await configService.clearCache();
});
afterAll(async () => {
  await pool.query(`UPDATE config_settings SET value = $1 WHERE key = 'rate_limits'`, [original]);
  await configService.clearCache();
  await closeConnections();
});

describe('rate limits → 429 + Retry-After', () => {
  test('guests are limited per IP', async () => {
    for (let i = 0; i < 5; i += 1) expect((await request(app).get('/api/v1/cuisines')).status).toBe(200);
    const res = await request(app).get('/api/v1/cuisines');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  test('logged-in users are limited per user, not per IP', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const get = (u) => request(app).get('/api/v1/cuisines').set('Authorization', `Bearer ${accessTokenFor(u)}`);
    for (let i = 0; i < 3; i += 1) expect((await get(a)).status).toBe(200);
    expect((await get(a)).status).toBe(429);
    expect((await get(b)).status).toBe(200); // same IP, different user
  });

  test('auth routes have their own per-IP limit', async () => {
    const login = () => request(app).post('/api/v1/auth/refresh');
    expect((await login()).status).toBe(401);
    expect((await login()).status).toBe(401);
    expect((await login()).status).toBe(429);
  });

  test('health is never limited', async () => {
    for (let i = 0; i < 8; i += 1) expect((await request(app).get('/api/v1/health')).status).toBe(200);
  });
});
