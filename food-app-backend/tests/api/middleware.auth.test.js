import express from 'express';
import request from 'supertest';
import { requireAuth, optionalAuth } from '../../src/middleware/auth.js';
import { adminOnly } from '../../src/middleware/adminOnly.js';
import { accessTokenFor, guestPass } from '../helpers/auth.js';

const app = express();
app.get('/private', requireAuth, (req, res) => res.json({ user: req.user }));
app.get('/public', optionalAuth, (req, res) => res.json({ user: req.user }));
app.get('/admin', requireAuth, adminOnly, (req, res) => res.json({ ok: true }));

const user = { id: 7, role: 'user' };
const admin = { id: 1, role: 'admin' };
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('requireAuth', () => {
  test('valid access token → req.user', async () => {
    const res = await request(app).get('/private').set(bearer(accessTokenFor(user)));
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: 7, role: 'user' });
  });

  test('no token / garbage / expired → 401', async () => {
    expect((await request(app).get('/private')).status).toBe(401);
    expect((await request(app).get('/private').set(bearer('abc.def.ghi'))).status).toBe(401);
    expect((await request(app).get('/private').set(bearer(accessTokenFor(user, { expiresIn: -10 })))).status).toBe(401);
  });

  test('guest pass is rejected on normal routes', async () => {
    expect((await request(app).get('/private').set(bearer(guestPass()))).status).toBe(401);
  });

  test('token signed with another secret → 401', async () => {
    const { default: jwt } = await import('jsonwebtoken');
    const forged = jwt.sign({ sub: 7, role: 'admin' }, 'some-other-secret-that-is-long-enough!!');
    expect((await request(app).get('/private').set(bearer(forged))).status).toBe(401);
  });
});

describe('optionalAuth', () => {
  test('no token → continues as guest', async () => {
    const res = await request(app).get('/public');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });

  test('valid token → req.user', async () => {
    const res = await request(app).get('/public').set(bearer(accessTokenFor(user)));
    expect(res.body.user).toEqual({ id: 7, role: 'user' });
  });

  test('expired token → 401 so the frontend refreshes', async () => {
    const res = await request(app).get('/public').set(bearer(accessTokenFor(user, { expiresIn: -10 })));
    expect(res.status).toBe(401);
  });
});

describe('adminOnly', () => {
  test('normal user → 403', async () => {
    const res = await request(app).get('/admin').set(bearer(accessTokenFor(user)));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_ALLOWED');
  });

  test('admin → allowed', async () => {
    expect((await request(app).get('/admin').set(bearer(accessTokenFor(admin)))).status).toBe(200);
  });
});
