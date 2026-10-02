import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { startOfIstMonth } from '../../src/services/journal.service.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, resetCache, insertPlace, insertStandardDish, insertMenuItem, lookupId } from '../helpers/db.js';
import { world, bearer, setCreatedAt } from '../helpers/fixtures.js';

const app = createApp();
const api = '/api/v1';
let w;

beforeEach(async () => {
  await resetData();
  await resetCache();
  w = await world();
});
afterAll(closeConnections);

const rateAt = async (user, itemId, stars, iso) => {
  const { rows } = await pool.query(
    'INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, is_current, created_at) VALUES ($1, $2, $3, true, false, $4) RETURNING id',
    [user.id, itemId, stars, iso],
  );
  return rows[0].id;
};
const journal = (user, q = {}) => request(app).get(`${api}/me/journal`).set(bearer(user)).query(q);

describe('GET /me/journal (3-hour cards)', () => {
  test('lunch + dinner at the same place on the same day = 2 cards', async () => {
    await rateAt(w.user, w.dalmaItem.id, 4, '2026-09-20T13:00:00+05:30');
    await rateAt(w.user, w.biryaniItem.id, 5, '2026-09-20T20:00:00+05:30');
    const res = await journal(w.user);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items.map((c) => c.entries[0].menuItemName)).toEqual(['Special Biryani', 'Dalma']); // newest first
  });

  test('dishes + review within 3 hours at one place = 1 card', async () => {
    await rateAt(w.user, w.dalmaItem.id, 4, '2026-09-20T13:00:00+05:30');
    await rateAt(w.user, w.biryaniItem.id, 5, '2026-09-20T13:20:00+05:30');
    const { rows } = await pool.query(`INSERT INTO place_reviews (user_id, place_id, stars) VALUES ($1, $2, 4) RETURNING id`, [w.user.id, w.place.id]);
    await setCreatedAt('place_reviews', rows[0].id, '2026-09-20T15:30:00+05:30');
    const res = await journal(w.user);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].entries.map((e) => e.kind)).toEqual(['rating', 'rating', 'review']);
    expect(res.body.data.items[0].place).toMatchObject({ name: 'Dalma Restaurant', area: 'Saheed Nagar' });
  });

  test('different places at the same time = separate cards; pagination works', async () => {
    const place2 = await insertPlace({ areaId: w.area.id, name: 'Tarini', lat: 20.29, lng: 85.85 });
    const item2 = await insertMenuItem({ placeId: place2.id, standardDishId: w.dalma.id, name: 'Dalma' });
    await rateAt(w.user, w.dalmaItem.id, 4, '2026-09-20T13:00:00+05:30');
    await rateAt(w.user, item2.id, 3, '2026-09-20T13:30:00+05:30');
    const first = await journal(w.user, { limit: 1 });
    expect(first.body.data.items[0].place.name).toBe('Tarini');
    const second = await journal(w.user, { limit: 1, cursor: first.body.data.nextCursor });
    expect(second.body.data.items[0].place.name).toBe('Dalma Restaurant');
    expect(second.body.data.nextCursor).toBeNull();
  });

  test('journal is personal: other users see nothing of mine', async () => {
    await rateAt(w.user, w.dalmaItem.id, 4, '2026-09-20T13:00:00+05:30');
    expect((await journal(w.other)).body.data.items).toEqual([]);
  });
});

describe('GET /me/stats', () => {
  test('all time vs this month', async () => {
    const odia = await lookupId('cuisines', 'Odia');
    await pool.query('UPDATE standard_dishes SET cuisine_id = $1 WHERE id = $2', [odia, w.dalma.id]);
    const thisMonth = new Date(startOfIstMonth().getTime() + 60 * 60 * 1000).toISOString();
    await rateAt(w.user, w.dalmaItem.id, 5, thisMonth);
    await rateAt(w.user, w.biryaniItem.id, 3, '2025-01-10T13:00:00+05:30');

    const all = await request(app).get(`${api}/me/stats`).set(bearer(w.user));
    expect(all.body.data).toMatchObject({
      period: 'all', placesTried: 1, dishesTried: 2, ratingsCount: 2,
      favouriteDish: { name: 'Dalma', avgStars: 5 },
    });
    const month = await request(app).get(`${api}/me/stats`).set(bearer(w.user)).query({ period: 'month' });
    expect(month.body.data).toMatchObject({ period: 'month', dishesTried: 1, ratingsCount: 1, topCuisine: { name: 'Odia' } });
  });

  test('per-dish comparison across places', async () => {
    const place2 = await insertPlace({ areaId: w.area.id, name: 'Tarini', lat: 20.29, lng: 85.85 });
    const item2 = await insertMenuItem({ placeId: place2.id, standardDishId: w.dalma.id, name: 'Odia Dalma' });
    await rateAt(w.user, w.dalmaItem.id, 3, '2026-09-01T13:00:00+05:30');
    await rateAt(w.user, item2.id, 5, '2026-09-02T13:00:00+05:30');
    const res = await request(app).get(`${api}/me/stats`).set(bearer(w.user));
    expect(res.body.data.comparisons).toEqual([
      { dish: 'Dalma', places: [{ placeId: place2.id, placeName: 'Tarini', stars: 5 }, { placeId: w.place.id, placeName: 'Dalma Restaurant', stars: 3 }] },
    ]);
  });

  test('empty stats for a new user', async () => {
    const res = await request(app).get(`${api}/me/stats`).set(bearer(w.other));
    expect(res.body.data).toMatchObject({ placesTried: 0, dishesTried: 0, topCuisine: null, favouriteDish: null, comparisons: [] });
  });
});

describe('GET /me/contributions', () => {
  test('places added (+ progress), dishes added, reports', async () => {
    const added = await insertPlace({ areaId: w.area.id, name: 'New Stall' });
    await pool.query('UPDATE places SET added_by = $1 WHERE id = $2', [w.user.id, added.id]);
    await pool.query('INSERT INTO place_confirmations (place_id, confirmed_by, weight) VALUES ($1, $2, 1.5)', [added.id, w.other.id]);
    const dish = await insertStandardDish({ name: 'Qwxz Curry' });
    await pool.query(`UPDATE standard_dishes SET status = 'pending_review', created_by = $1 WHERE id = $2`, [w.user.id, dish.id]);
    await pool.query(`INSERT INTO place_reports (place_id, reported_by, reason) VALUES ($1, $2, 'closed')`, [w.place.id, w.user.id]);

    const res = await request(app).get(`${api}/me/contributions`).set(bearer(w.user));
    expect(res.body.data.places).toEqual([expect.objectContaining({ name: 'New Stall', status: 'unverified', verification: { confirmations: 1.5, threshold: 5 } })]);
    expect(res.body.data.dishes).toEqual([expect.objectContaining({ name: 'Qwxz Curry', status: 'pending_review' })]);
    expect(res.body.data.reports).toEqual([expect.objectContaining({ placeName: 'Dalma Restaurant', reason: 'closed', status: 'pending' })]);
  });
});

describe('GET /users/:id/journal (public)', () => {
  test('private by default → 403; public → timeline + stats, no login needed', async () => {
    await rateAt(w.user, w.dalmaItem.id, 4, '2026-09-20T13:00:00+05:30');
    expect((await request(app).get(`${api}/users/${w.user.id}/journal`)).body.error.code).toBe('JOURNAL_PRIVATE');
    await pool.query(`UPDATE users SET journal_visibility = 'public' WHERE id = $1`, [w.user.id]);
    const res = await request(app).get(`${api}/users/${w.user.id}/journal`);
    expect(res.body.data.user).toEqual({ id: w.user.id, name: 'Asha', avatarUrl: null });
    expect(res.body.data.timeline.items).toHaveLength(1);
    expect(res.body.data.stats.ratingsCount).toBe(1);
    expect(JSON.stringify(res.body)).not.toContain('@example.com'); // never leaks email
  });
});
