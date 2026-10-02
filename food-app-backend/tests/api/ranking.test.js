import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as rankingService from '../../src/services/helpers/ranking.js';
import * as configService from '../../src/services/helpers/config.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, resetCache, insertUser, insertPlace, insertMenuItem, ageUser } from '../helpers/db.js';
import { world } from '../helpers/fixtures.js';

const app = createApp();
const api = '/api/v1';
let w;

beforeEach(async () => {
  await resetData();
  await resetCache();
  w = await world();
});
afterAll(async () => {
  await pool.query(`UPDATE config_settings SET value = '{"minStars": 4, "minOrderAgainPct": 70}' WHERE key = 'must_order'`);
  await closeConnections();
});

// n users, each N days old (default: old enough to be "normal")
const makeUsers = async (n, days = 60) => {
  const users = [];
  for (let i = 0; i < n; i += 1) {
    const u = await insertUser();
    await ageUser(u.id, days);
    users.push(u);
  }
  return users;
};
const rate = (userId, menuItemId, stars, wouldOrderAgain = true) =>
  pool.query('INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again) VALUES ($1, $2, $3, $4)', [userId, menuItemId, stars, wouldOrderAgain]);
const statsOf = async (menuItemId) => (await pool.query('SELECT * FROM menu_item_stats WHERE menu_item_id = $1', [menuItemId])).rows[0];

describe('Bayesian ranking (menu_item_stats)', () => {
  test('one 5★ rating cannot beat 4.6★ from 80 people', async () => {
    const place2 = await insertPlace({ areaId: w.area.id, name: 'One Hit Wonder', lat: 20.29, lng: 85.85 });
    const lucky = await insertMenuItem({ placeId: place2.id, standardDishId: w.biryani.id, name: 'Biryani' });
    const crowd = await makeUsers(81);
    for (let i = 0; i < 80; i += 1) await rate(crowd[i].id, w.biryaniItem.id, i < 48 ? 5 : 4); // avg 4.6
    await rate(crowd[80].id, lucky.id, 5);
    await rankingService.refreshStats();

    expect((await statsOf(w.biryaniItem.id)).avg_stars).toBeCloseTo(4.6, 2);
    expect((await statsOf(lucky.id)).avg_stars).toBe(5);
    expect((await statsOf(w.biryaniItem.id)).bayes_score).toBeGreaterThan((await statsOf(lucky.id)).bayes_score);

    const best = await request(app).get(`${api}/dishes/${w.biryani.id}/best`);
    expect(best.body.data.items.map((i) => i.place.name)).toEqual(['Dalma Restaurant', 'One Hit Wonder']);
  });

  test('matches the JS mirror of the formula', async () => {
    const users = await makeUsers(3);
    for (const [i, s] of [5, 4, 3].entries()) await rate(users[i].id, w.dalmaItem.id, s);
    await rankingService.refreshStats();
    const prior = await configService.get('bayes_prior');
    const expected = rankingService.bayesianScore({ prior, ratings: [5, 4, 3].map((stars) => ({ stars, weight: 1 })) });
    expect((await statsOf(w.dalmaItem.id)).bayes_score).toBeCloseTo(expected, 2); // view stores 3 decimals
  });

  test('only current, not-removed ratings count', async () => {
    const [a, b] = await makeUsers(2);
    await rate(a.id, w.dalmaItem.id, 5);
    await pool.query('INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, is_current) VALUES ($1, $2, 1, false, false)', [a.id, w.dalmaItem.id]);
    await rate(b.id, w.dalmaItem.id, 1);
    await pool.query('UPDATE dish_ratings SET deleted_at = now() WHERE user_id = $1', [b.id]);
    await rankingService.refreshStats();
    expect(await statsOf(w.dalmaItem.id)).toMatchObject({ rating_count: 1, avg_stars: 5 });
  });
});

describe('labels', () => {
  test('Must order needs ≥ 5 ratings, ≥ 4★ and ≥ 70% order again', async () => {
    const users = await makeUsers(5);
    for (const u of users.slice(0, 4)) await rate(u.id, w.dalmaItem.id, 5);
    await rankingService.refreshStats();
    expect((await statsOf(w.dalmaItem.id)).label).toBeNull(); // only 4 ratings
    await rate(users[4].id, w.dalmaItem.id, 4, false);       // 5 ratings, 80 % order again
    await rankingService.refreshStats();
    expect(await statsOf(w.dalmaItem.id)).toMatchObject({ rating_count: 5, label: 'must_order', order_again_pct: 80 });
  });

  test('Mixed reviews: ≤ 2.5★ or < 40 % order again', async () => {
    const users = await makeUsers(5);
    for (const u of users) await rate(u.id, w.dalmaItem.id, 4, u === users[0]); // 4★ but only 20 % order again
    await rankingService.refreshStats();
    expect((await statsOf(w.dalmaItem.id)).label).toBe('mixed_reviews');
  });

  test('thresholds come from config', async () => {
    const users = await makeUsers(5);
    for (const u of users) await rate(u.id, w.dalmaItem.id, 4);
    await rankingService.refreshStats();
    expect((await statsOf(w.dalmaItem.id)).label).toBe('must_order');
    await pool.query(`UPDATE config_settings SET value = '{"minStars": 4.5, "minOrderAgainPct": 70}' WHERE key = 'must_order'`);
    await rankingService.refreshStats();
    expect((await statsOf(w.dalmaItem.id)).label).toBeNull();
  });

  test('typical spice = most common answer', async () => {
    const users = await makeUsers(3);
    for (const [i, spice] of ['spicy', 'spicy', 'mild'].entries()) {
      await pool.query('INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, spice) VALUES ($1, $2, 4, true, $3)', [users[i].id, w.biryaniItem.id, spice]);
    }
    await rankingService.refreshStats();
    expect((await statsOf(w.biryaniItem.id)).typical_spice).toBe('spicy');
  });
});

describe('trust weighting (current trust, never a snapshot)', () => {
  test("a spammer's trust drop shrinks all their old ratings", async () => {
    const [honest, spammer] = await makeUsers(2);
    await rate(honest.id, w.dalmaItem.id, 5);
    await rate(spammer.id, w.dalmaItem.id, 1);
    await rankingService.refreshStats();
    expect((await statsOf(w.dalmaItem.id)).avg_stars).toBe(3); // 1.0 + 1.0 weights

    await pool.query('UPDATE users SET trust_score = 0.1 WHERE id = $1', [spammer.id]);
    await rankingService.refreshStats();
    expect((await statsOf(w.dalmaItem.id)).avg_stars).toBeCloseTo((5 * 1 + 1 * 0.1) / 1.1, 2); // ≈ 4.64
  });

  test('new accounts count 0.5, trusted 2.0', async () => {
    const [normal] = await makeUsers(1);
    const [fresh] = await makeUsers(1, 1);
    await rate(normal.id, w.dalmaItem.id, 5);
    await rate(fresh.id, w.dalmaItem.id, 2);
    await rankingService.refreshStats();
    expect((await statsOf(w.dalmaItem.id)).avg_stars).toBeCloseTo((5 + 2 * 0.5) / 1.5, 2); // 4.0

    await pool.query('UPDATE users SET trust_score = 2.5 WHERE id = $1', [normal.id]);
    await rankingService.refreshStats();
    expect((await statsOf(w.dalmaItem.id)).avg_stars).toBeCloseTo((5 * 2 + 2 * 0.5) / 2.5, 2); // 4.4
  });

  test('anonymised ratings (deleted account) still count as normal', async () => {
    await rate(null, w.dalmaItem.id, 4);
    await rankingService.refreshStats();
    expect(await statsOf(w.dalmaItem.id)).toMatchObject({ rating_count: 1, avg_stars: 4 });
  });
});

describe('place_stats + API', () => {
  test('facilities = majority answer; tags shown after 3+ votes', async () => {
    const users = await makeUsers(3);
    const answers = [{ wifi: true, noise: 'quiet' }, { wifi: true, noise: 'quiet' }, { wifi: false, noise: 'loud' }];
    for (const [i, a] of answers.entries()) {
      await pool.query('INSERT INTO place_reviews (user_id, place_id, stars, wifi, noise) VALUES ($1, $2, 4, $3, $4)', [users[i].id, w.place.id, a.wifi, a.noise]);
    }
    const work = (await pool.query(`SELECT id FROM tags WHERE name = 'Work' AND type = 'mood'`)).rows[0].id;
    const date = (await pool.query(`SELECT id FROM tags WHERE name = 'Date' AND type = 'mood'`)).rows[0].id;
    for (const u of users) await pool.query(`INSERT INTO place_tag_votes (place_id, tag_id, user_id, source) VALUES ($1, $2, $3, 'user')`, [w.place.id, work, u.id]);
    await pool.query(`INSERT INTO place_tag_votes (place_id, tag_id, user_id, source) VALUES ($1, $2, $3, 'auto')`, [w.place.id, date, users[0].id]);
    await rankingService.refreshStats();

    const res = await request(app).get(`${api}/places/${w.place.id}`);
    expect(res.body.data.stats).toMatchObject({ reviewCount: 3, avgStars: 4, wifi: true, noise: 'quiet', acceptsUpi: null });
    expect(res.body.data.stats.tags).toEqual([{ id: work, name: 'Work', type: 'mood' }]); // Date has only 1 vote
  });

  test('place page lists Must order dishes; menu + dish page carry stats', async () => {
    const users = await makeUsers(5);
    for (const u of users) await rate(u.id, w.dalmaItem.id, 5);
    await rankingService.refreshStats();
    const place = await request(app).get(`${api}/places/${w.place.id}`);
    expect(place.body.data.mustOrder).toEqual([expect.objectContaining({ name: 'Dalma', label: 'must_order', ratingCount: 5 })]);
    expect(place.body.data.mixedReviews).toEqual([]);
    const menu = await request(app).get(`${api}/places/${w.place.id}/menu`);
    expect(menu.body.data.find((m) => m.name === 'Dalma').stats).toMatchObject({ label: 'must_order', avgStars: 5 });
    const dish = await request(app).get(`${api}/menu-items/${w.dalmaItem.id}`);
    expect(dish.body.data.stats).toMatchObject({ ratingCount: 5, label: 'must_order' });
  });

  test('best places for a dish hides closed places and shows distance with lat/lng', async () => {
    const [u] = await makeUsers(1);
    await rate(u.id, w.dalmaItem.id, 4);
    await rankingService.refreshStats();
    const near = await request(app).get(`${api}/dishes/${w.dalma.id}/best`).query({ lat: 20.2887, lng: 85.8488 });
    expect(near.body.data.items[0]).toMatchObject({ place: { name: 'Dalma Restaurant' }, distanceM: 0 });
    await pool.query(`UPDATE places SET status = 'closed' WHERE id = $1`, [w.place.id]);
    expect((await request(app).get(`${api}/dishes/${w.dalma.id}/best`)).body.data.items).toEqual([]);
    expect((await request(app).get(`${api}/dishes/999999/best`)).status).toBe(404);
  });
});
