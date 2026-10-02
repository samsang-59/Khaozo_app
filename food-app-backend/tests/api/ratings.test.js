import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as ratingRepo from '../../src/repositories/rating.repo.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, resetCache } from '../helpers/db.js';
import { world, bearer, backdate } from '../helpers/fixtures.js';

const app = createApp();
const api = '/api/v1';
let w;

beforeEach(async () => {
  await resetData();
  await resetCache();
  w = await world();
});
afterAll(closeConnections);

const rate = (user, itemId, body) => request(app).post(`${api}/menu-items/${itemId}/ratings`).set(bearer(user)).send(body);
const ratingsOf = async (userId) => (await pool.query('SELECT * FROM dish_ratings WHERE user_id = $1 ORDER BY id', [userId])).rows;

describe('POST /menu-items/:id/ratings', () => {
  test('stars + would order again are required (10-second rating)', async () => {
    expect((await rate(w.user, w.biryaniItem.id, { stars: 5 })).status).toBe(400);
    expect((await rate(w.user, w.biryaniItem.id, { wouldOrderAgain: true })).status).toBe(400);
    const res = await rate(w.user, w.biryaniItem.id, { stars: 5, wouldOrderAgain: true });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ stars: 5, wouldOrderAgain: true, isCurrent: true });
  });

  test('all optional details are saved', async () => {
    const res = await rate(w.user, w.biryaniItem.id, {
      stars: 4, wouldOrderAgain: true, taste: 5, portion: 3, value: 4,
      spice: 'spicy', sweetness: 'low', oiliness: 'medium', reviewText: 'Great dum flavour', pricePaid: 260,
    });
    expect(res.body.data).toMatchObject({ spice: 'spicy', oiliness: 'medium', pricePaid: 260, reviewText: 'Great dum flavour' });
  });

  test('out-of-range values are rejected', async () => {
    expect((await rate(w.user, w.biryaniItem.id, { stars: 6, wouldOrderAgain: true })).status).toBe(400);
    expect((await rate(w.user, w.biryaniItem.id, { stars: 4, wouldOrderAgain: true, spice: 'extreme' })).status).toBe(400);
  });

  test('re-rating within 30 days → 409 with the rating to edit', async () => {
    const first = await rate(w.user, w.biryaniItem.id, { stars: 4, wouldOrderAgain: true });
    const again = await rate(w.user, w.biryaniItem.id, { stars: 2, wouldOrderAgain: false });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('RATING_TOO_SOON');
    expect(again.body.error.details.ratingId).toBe(first.body.data.id);
    expect(await ratingsOf(w.user.id)).toHaveLength(1);
  });

  test('re-rating after 30 days → old rating kept as history (is_current = false)', async () => {
    const first = await rate(w.user, w.biryaniItem.id, { stars: 4, wouldOrderAgain: true });
    await backdate('dish_ratings', first.body.data.id, '31 days');
    const second = await rate(w.user, w.biryaniItem.id, { stars: 2, wouldOrderAgain: false });
    expect(second.status).toBe(201);
    const rows = await ratingsOf(w.user.id);
    expect(rows.map((r) => [r.stars, r.is_current])).toEqual([[4, false], [2, true]]);
  });

  test('transaction rollback: if the new rating fails, the old one stays current', async () => {
    const first = await rate(w.user, w.biryaniItem.id, { stars: 4, wouldOrderAgain: true });
    await backdate('dish_ratings', first.body.data.id, '31 days');
    // second write (INSERT) breaks a CHECK constraint after the first write (UPDATE) ran
    await expect(ratingRepo.replaceCurrent(w.user.id, w.biryaniItem.id, { stars: 9, wouldOrderAgain: true })).rejects.toThrow();
    const rows = await ratingsOf(w.user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].is_current).toBe(true);
  });

  test('marks matching wishlist items as tried (menu item and standard dish)', async () => {
    await pool.query(
      `INSERT INTO wishlist_items (user_id, menu_item_id) VALUES ($1, $2);
       INSERT INTO wishlist_items (user_id, standard_dish_id) VALUES ($1, $3);
       INSERT INTO wishlist_items (user_id, place_id) VALUES ($1, $4)`.replace(/\$1/g, w.user.id).replace('$2', w.biryaniItem.id).replace('$3', w.biryani.id).replace('$4', w.place.id),
    );
    await rate(w.user, w.biryaniItem.id, { stars: 5, wouldOrderAgain: true });
    const { rows } = await pool.query('SELECT menu_item_id, standard_dish_id, place_id, tried_at FROM wishlist_items ORDER BY id');
    expect(rows.map((r) => r.tried_at !== null)).toEqual([true, true, false]); // saving the place isn't "tried"
  });

  test('removed menu items, closed places and logged-out users cannot rate', async () => {
    await pool.query(`UPDATE menu_items SET status = 'removed' WHERE id = $1`, [w.dalmaItem.id]);
    expect((await rate(w.user, w.dalmaItem.id, { stars: 4, wouldOrderAgain: true })).body.error.code).toBe('MENU_ITEM_NOT_FOUND');
    await pool.query(`UPDATE places SET status = 'closed' WHERE id = $1`, [w.place.id]);
    expect((await rate(w.user, w.biryaniItem.id, { stars: 4, wouldOrderAgain: true })).body.error.code).toBe('PLACE_CLOSED');
    expect((await request(app).post(`${api}/menu-items/${w.biryaniItem.id}/ratings`).send({ stars: 4, wouldOrderAgain: true })).status).toBe(401);
  });
});

describe('PATCH / DELETE /ratings/:id', () => {
  test('owner can edit; others get 403', async () => {
    const { body } = await rate(w.user, w.biryaniItem.id, { stars: 4, wouldOrderAgain: true });
    const edit = await request(app).patch(`${api}/ratings/${body.data.id}`).set(bearer(w.user)).send({ stars: 5, spice: 'very_spicy' });
    expect(edit.body.data).toMatchObject({ stars: 5, spice: 'very_spicy', wouldOrderAgain: true });
    const hack = await request(app).patch(`${api}/ratings/${body.data.id}`).set(bearer(w.other)).send({ stars: 1 });
    expect(hack.status).toBe(403);
  });

  test('history (non-current) ratings cannot be edited', async () => {
    const first = await rate(w.user, w.biryaniItem.id, { stars: 4, wouldOrderAgain: true });
    await backdate('dish_ratings', first.body.data.id, '31 days');
    await rate(w.user, w.biryaniItem.id, { stars: 3, wouldOrderAgain: true });
    const res = await request(app).patch(`${api}/ratings/${first.body.data.id}`).set(bearer(w.user)).send({ stars: 1 });
    expect(res.body.error.code).toBe('RATING_NOT_CURRENT');
  });

  test('owner can delete; others cannot', async () => {
    const { body } = await rate(w.user, w.biryaniItem.id, { stars: 4, wouldOrderAgain: true });
    expect((await request(app).delete(`${api}/ratings/${body.data.id}`).set(bearer(w.other))).status).toBe(403);
    expect((await request(app).delete(`${api}/ratings/${body.data.id}`).set(bearer(w.user))).status).toBe(200);
    expect(await ratingsOf(w.user.id)).toHaveLength(0);
  });
});

describe('dish page + ratings list', () => {
  test('GET /menu-items/:id shows "your rating" only when logged in', async () => {
    await rate(w.user, w.biryaniItem.id, { stars: 5, wouldOrderAgain: true });
    const guest = await request(app).get(`${api}/menu-items/${w.biryaniItem.id}`);
    expect(guest.body.data).toMatchObject({ name: 'Special Biryani', place: { name: 'Dalma Restaurant' }, standardDish: { name: 'Chicken Dum Biryani' } });
    expect(guest.body.data.myRating).toBeUndefined();
    const mine = await request(app).get(`${api}/menu-items/${w.biryaniItem.id}`).set(bearer(w.user));
    expect(mine.body.data.myRating).toMatchObject({ stars: 5 });
  });

  test('GET /menu-items/:id/ratings lists current ratings newest first with pagination', async () => {
    const a = await rate(w.user, w.biryaniItem.id, { stars: 5, wouldOrderAgain: true, reviewText: 'Superb' });
    await backdate('dish_ratings', a.body.data.id, '2 days');
    await rate(w.other, w.biryaniItem.id, { stars: 3, wouldOrderAgain: false });
    const first = await request(app).get(`${api}/menu-items/${w.biryaniItem.id}/ratings`).query({ limit: 1 });
    expect(first.body.data.items.map((r) => r.userName)).toEqual(['Ravi']);
    const second = await request(app).get(`${api}/menu-items/${w.biryaniItem.id}/ratings`).query({ limit: 1, cursor: first.body.data.nextCursor });
    expect(second.body.data.items[0]).toMatchObject({ userName: 'Asha', reviewText: 'Superb', photos: [] });
    expect(second.body.data.nextCursor).toBeNull();
  });
});
