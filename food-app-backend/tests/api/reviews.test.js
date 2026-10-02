import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, resetCache } from '../helpers/db.js';
import { world, bearer, backdate } from '../helpers/fixtures.js';

const app = createApp();
const api = '/api/v1';
let w;
let tag;

beforeEach(async () => {
  await resetData();
  await resetCache();
  w = await world();
  const { rows } = await pool.query(`SELECT id, name FROM tags WHERE (name, type) IN (('Work','mood'),('Date','mood'),('Dinner','meal_time'))`);
  tag = Object.fromEntries(rows.map((r) => [r.name, r.id]));
});
afterAll(closeConnections);

const review = (user, body) => request(app).post(`${api}/places/${w.place.id}/reviews`).set(bearer(user)).send(body);
const votes = async () =>
  (await pool.query('SELECT user_id, tag_id, source FROM place_tag_votes WHERE place_id = $1 ORDER BY user_id, tag_id', [w.place.id])).rows;

describe('POST /places/:id/reviews', () => {
  test('stars required; facilities saved as tick boxes; tag votes stored', async () => {
    expect((await review(w.user, { noise: 'quiet' })).status).toBe(400);
    const res = await review(w.user, {
      stars: 4, vibe: 5, noise: 'quiet', wifi: true, plugPoints: true, acceptsUpi: true, acceptsCash: false,
      crowd: 'okay', reviewText: 'Calm place', tagIds: [tag.Work, tag.Dinner],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ stars: 4, noise: 'quiet', wifi: true, acceptsCash: false, tagIds: [tag.Work, tag.Dinner].sort((a, b) => a - b) });
    expect(await votes()).toEqual([
      { user_id: w.user.id, tag_id: Math.min(tag.Work, tag.Dinner), source: 'user' },
      { user_id: w.user.id, tag_id: Math.max(tag.Work, tag.Dinner), source: 'user' },
    ]);
  });

  test('one current review per user per place (30-day rule)', async () => {
    const first = await review(w.user, { stars: 4 });
    const again = await review(w.user, { stars: 2 });
    expect(again.body.error).toMatchObject({ code: 'REVIEW_TOO_SOON', details: { reviewId: first.body.data.id } });
    await backdate('place_reviews', first.body.data.id, '31 days');
    expect((await review(w.user, { stars: 2 })).status).toBe(201);
    const { rows } = await pool.query('SELECT stars, is_current FROM place_reviews WHERE user_id = $1 ORDER BY id', [w.user.id]);
    expect(rows).toEqual([{ stars: 4, is_current: false }, { stars: 2, is_current: true }]);
  });

  test('tag vote is unique per user / tag / place (duplicates collapse)', async () => {
    await review(w.user, { stars: 4, tagIds: [tag.Work, tag.Work] });
    expect(await votes()).toHaveLength(1);
    await review(w.other, { stars: 5, tagIds: [tag.Work] });
    expect(await votes()).toHaveLength(2); // a different user may vote the same tag
  });

  test('unknown tag → 400', async () => {
    expect((await review(w.user, { stars: 4, tagIds: [999999] })).body.error.code).toBe('TAG_NOT_FOUND');
  });
});

describe('PATCH / DELETE /reviews/:id', () => {
  test('editing tags replaces the user votes (owner only)', async () => {
    const { body } = await review(w.user, { stars: 4, tagIds: [tag.Work] });
    const res = await request(app).patch(`${api}/reviews/${body.data.id}`).set(bearer(w.user)).send({ stars: 5, tagIds: [tag.Date] });
    expect(res.body.data).toMatchObject({ stars: 5, tagIds: [tag.Date] });
    expect((await votes()).map((v) => v.tag_id)).toEqual([tag.Date]);
    expect((await request(app).patch(`${api}/reviews/${body.data.id}`).set(bearer(w.other)).send({ stars: 1 })).status).toBe(403);
  });

  test('delete by owner', async () => {
    const { body } = await review(w.user, { stars: 4 });
    expect((await request(app).delete(`${api}/reviews/${body.data.id}`).set(bearer(w.other))).status).toBe(403);
    expect((await request(app).delete(`${api}/reviews/${body.data.id}`).set(bearer(w.user))).status).toBe(200);
  });
});

test('GET /places/:id/reviews lists current reviews', async () => {
  await review(w.user, { stars: 4, reviewText: 'Nice' });
  const res = await request(app).get(`${api}/places/${w.place.id}/reviews`);
  expect(res.body.data.items).toEqual([expect.objectContaining({ stars: 4, reviewText: 'Nice', userName: 'Asha', photos: [] })]);
});
