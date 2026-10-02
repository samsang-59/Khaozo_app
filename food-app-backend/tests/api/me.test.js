import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, insertUser, lookupId } from '../helpers/db.js';
import { accessTokenFor } from '../helpers/auth.js';
import { makeAdmin } from '../../scripts/make-admin.js';

const app = createApp();
let user;
let auth;

beforeEach(async () => {
  await resetData();
  user = await insertUser({ name: 'Asha', email: 'asha@example.com' });
  await pool.query('INSERT INTO taste_profiles (user_id) VALUES ($1)', [user.id]);
  auth = { Authorization: `Bearer ${accessTokenFor(user)}` };
});
afterAll(closeConnections);

describe('/me', () => {
  test('GET /me returns the profile', async () => {
    const res = await request(app).get('/api/v1/me').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: user.id, name: 'Asha', email: 'asha@example.com', role: 'user', journalVisibility: 'private' });
  });

  test('GET /me without login → 401', async () => {
    expect((await request(app).get('/api/v1/me')).status).toBe(401);
  });

  test('PATCH /me updates name and journal visibility', async () => {
    const res = await request(app).patch('/api/v1/me').set(auth).send({ name: 'Asha P', journalVisibility: 'public' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Asha P', journalVisibility: 'public' });
  });

  test('PATCH /me rejects unknown fields (role can never be self-set)', async () => {
    const res = await request(app).patch('/api/v1/me').set(auth).send({ role: 'admin' });
    expect(res.status).toBe(400);
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
    expect(rows[0].role).toBe('user');
  });
});

describe('/me/taste-profile', () => {
  test('GET returns the empty profile', async () => {
    const res = await request(app).get('/api/v1/me/taste-profile').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      diet: null, quizDone: false, ratingsUsed: 0, cuisineIds: [], avoidIds: [],
      effective: { spice: null, sweet: null, oiliness: null, budget: null },
    });
  });

  test('PUT saves the quiz (skipped questions stay null)', async () => {
    const odia = await lookupId('cuisines', 'Odia');
    const chinese = await lookupId('cuisines', 'Chinese');
    const prawn = await lookupId('main_ingredients', 'Prawn');
    const res = await request(app).put('/api/v1/me/taste-profile').set(auth)
      .send({ diet: 'non_veg', spice: 3, budget: 2, cuisineIds: [odia, chinese], avoidIds: [prawn] });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      diet: 'non_veg', quizDone: true,
      cuisineIds: [odia, chinese].sort((a, b) => a - b), avoidIds: [prawn],
      fields: { spice: { quiz: 3, learned: null, locked: false }, sweet: { quiz: null } },
      effective: { spice: 3, sweet: null, budget: 2 },
    });
  });

  test('PUT rejects out-of-range answers and unknown cuisines', async () => {
    expect((await request(app).put('/api/v1/me/taste-profile').set(auth).send({ spice: 5 })).status).toBe(400);
    const res = await request(app).put('/api/v1/me/taste-profile').set(auth).send({ cuisineIds: [999999] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CUISINE_NOT_FOUND');
  });

  test('PATCH edits a field and locks it', async () => {
    await request(app).put('/api/v1/me/taste-profile').set(auth).send({ spice: 2 });
    const res = await request(app).patch('/api/v1/me/taste-profile').set(auth).send({ spice: 4 });
    expect(res.status).toBe(200);
    expect(res.body.data.fields.spice).toEqual({ quiz: 2, learned: 4, locked: true });
    expect(res.body.data.effective.spice).toBe(4);
    expect(res.body.data.fields.sweet.locked).toBe(false); // untouched fields stay unlocked
  });

  test('locked field is not changed by a later quiz save', async () => {
    await request(app).patch('/api/v1/me/taste-profile').set(auth).send({ spice: 4 });
    const res = await request(app).put('/api/v1/me/taste-profile').set(auth).send({ spice: 1 });
    expect(res.body.data.fields.spice).toEqual({ quiz: 1, learned: 4, locked: true });
    expect(res.body.data.effective.spice).toBe(4); // the user's own edit wins permanently
  });

  test('PATCH with nothing to update → 400', async () => {
    expect((await request(app).patch('/api/v1/me/taste-profile').set(auth).send({})).status).toBe(400);
  });
});

describe('ADMIN_EMAIL script', () => {
  test('sets role = admin for that email (case-insensitive)', async () => {
    const updated = await makeAdmin('ASHA@example.com');
    expect(updated.role).toBe('admin');
    const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [user.id]);
    expect(rows[0].role).toBe('admin');
  });

  test('fails clearly if that user has never logged in', async () => {
    await expect(makeAdmin('nobody@example.com')).rejects.toThrow(/log in with Google once first/);
  });
});
