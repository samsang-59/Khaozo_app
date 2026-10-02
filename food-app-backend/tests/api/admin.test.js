import { jest } from '@jest/globals';

// See what gets queued without a real BullMQ queue
const add = jest.fn(async () => true);
jest.unstable_mockModule('../../src/services/helpers/jobQueue.js', () => ({
  add,
  close: async () => {},
  JOBS: {
    REFRESH_STATS: 'stats.refresh', LEARN_TASTE: 'taste.learn', AUTO_TAGS: 'tags.auto', TRUST_SCORES: 'trust.recalculate',
    SESSION_CLEANUP: 'sessions.cleanup', EMBED_DISHES: 'dishes.embed', EMBED_REVIEW: 'review.embed', SUMMARY: 'summary.refresh',
    DELETE_PHOTOS: 'photos.delete',
  },
}));

const { default: request } = await import('supertest');
const { createApp } = await import('../../src/app.js');
const { pool } = await import('../../src/config/db.js');
const configService = await import('../../src/services/helpers/config.js');
const { closeConnections } = await import('../helpers/connections.js');
const { resetData, resetCache, insertUser, insertPlace, insertStandardDish, insertMenuItem, insertHours, lookupId } = await import('../helpers/db.js');
const { world, bearer, backdate } = await import('../helpers/fixtures.js');

const app = createApp();
const api = '/api/v1';
let w;
let admin;

beforeEach(async () => {
  await resetData();
  await resetCache();
  add.mockClear();
  w = await world();
  admin = await insertUser({ name: 'Admin', role: 'admin' });
});
afterAll(closeConnections);

const report = (user, placeId, body) => request(app).post(`${api}/places/${placeId}/reports`).set(bearer(user)).send(body);
const resolve = (id, body) => request(app).patch(`${api}/admin/reports/${id}`).set(bearer(admin)).send(body);
const placeRow = async (id) => (await pool.query('SELECT *, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM places WHERE id = $1', [id])).rows[0];

describe('admin access', () => {
  const routes = [
    ['get', '/admin/reports'], ['patch', '/admin/reports/1'], ['get', '/admin/places'], ['patch', '/admin/places/1'],
    ['get', '/admin/dishes/pending'], ['post', '/admin/dishes'], ['patch', '/admin/dishes/1'],
    ['delete', '/admin/reviews/1'], ['delete', '/admin/ratings/1'], ['get', '/admin/config'], ['patch', '/admin/config'],
  ];

  test('normal user → 403 and no token → 401 on every admin route', async () => {
    for (const [method, path] of routes) {
      expect((await request(app)[method](`${api}${path}`).set(bearer(w.user)).send({})).status).toBe(403);
      expect((await request(app)[method](`${api}${path}`).send({})).status).toBe(401);
    }
  });

  test('admin gets in', async () => {
    expect((await request(app).get(`${api}/admin/config`).set(bearer(admin))).status).toBe(200);
  });
});

describe('reports queue', () => {
  test('lists pending reports oldest first with reporter and place', async () => {
    const a = await report(w.user, w.place.id, { reason: 'closed' });
    await report(w.other, w.place.id, { reason: 'wrong_info', suggestedChange: { text: 'Name is Dalma Family Restaurant' } });
    const res = await request(app).get(`${api}/admin/reports`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((r) => r.id)).toEqual([a.body.data.id, a.body.data.id + 1]);
    expect(res.body.data.items[0]).toMatchObject({ reason: 'closed', placeName: 'Dalma Restaurant', reportedByName: 'Asha', status: 'pending' });
    expect((await request(app).get(`${api}/admin/reports?status=accepted`).set(bearer(admin))).body.data.items).toEqual([]);
  });

  test('accept "closed" → place closed, report accepted by this admin, stats refresh queued', async () => {
    const { body } = await report(w.user, w.place.id, { reason: 'closed' });
    const res = await resolve(body.data.id, { action: 'accept' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'accepted' });
    expect((await placeRow(w.place.id)).status).toBe('closed');
    const { rows } = await pool.query('SELECT reviewed_by, reviewed_at FROM place_reports WHERE id = $1', [body.data.id]);
    expect(rows[0].reviewed_by).toBe(admin.id);
    expect(rows[0].reviewed_at).not.toBeNull();
    expect(add).toHaveBeenCalledWith('stats.refresh', {});
    // the reporter sees it in My Contributions
    const mine = await request(app).get(`${api}/me/contributions`).set(bearer(w.user));
    expect(mine.body.data.reports[0].status).toBe('accepted');
  });

  test('accept "wrong_hours" replaces the hours with the suggestion (place cache cleared)', async () => {
    await insertHours(w.place.id, [{ day: 1, opensAt: '09:00', closesAt: '17:00' }]);
    await request(app).get(`${api}/places/${w.place.id}`); // warm the place cache
    const hours = [{ day: 1, opensAt: '11:00', closesAt: '23:00' }, { day: 2, opensAt: '11:00', closesAt: '23:00' }];
    const { body } = await report(w.user, w.place.id, { reason: 'wrong_hours', suggestedChange: { hours } });
    expect((await resolve(body.data.id, { action: 'accept' })).status).toBe(200);
    const page = await request(app).get(`${api}/places/${w.place.id}`);
    expect(page.body.data.hours).toEqual(hours);
  });

  test('accept "wrong_location": the admin\'s corrected pin wins over the suggestion', async () => {
    const { body } = await report(w.user, w.place.id, { reason: 'wrong_location', suggestedChange: { lat: 20.30, lng: 85.83 } });
    expect((await resolve(body.data.id, { action: 'accept', change: { lat: 20.3101, lng: 85.8402 } })).status).toBe(200);
    const p = await placeRow(w.place.id);
    expect(p.lat).toBeCloseTo(20.3101, 4);
    expect(p.lng).toBeCloseTo(85.8402, 4);
  });

  test('accept "wrong_location" with no pin anywhere → 400, report stays pending', async () => {
    const { body } = await report(w.user, w.place.id, { reason: 'wrong_location', details: 'It is across the road' });
    const res = await resolve(body.data.id, { action: 'accept' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REPORT_CHANGE_REQUIRED');
    expect((await pool.query('SELECT status FROM place_reports WHERE id = $1', [body.data.id])).rows[0].status).toBe('pending');
    // a pin outside Bhubaneswar is refused too
    expect((await resolve(body.data.id, { action: 'accept', change: { lat: 19.0, lng: 72.8 } })).body.error.code).toBe('OUTSIDE_SERVICE_AREA');
  });

  test('accept "wrong_info" applies the admin\'s structured fix; without one it is just acknowledged', async () => {
    const one = await report(w.user, w.place.id, { reason: 'wrong_info', suggestedChange: { text: 'It is a cafe now' } });
    expect((await resolve(one.body.data.id, { action: 'accept', change: { placeType: 'cafe', priceLevel: 2 } })).status).toBe(200);
    expect(await placeRow(w.place.id)).toMatchObject({ place_type: 'cafe', price_level: 2, name: 'Dalma Restaurant' });

    const two = await report(w.other, w.place.id, { reason: 'wrong_info', suggestedChange: { text: 'Phone changed' } });
    expect((await resolve(two.body.data.id, { action: 'accept' })).body.data.status).toBe('accepted');
  });

  test('accept "not_found" → place soft-deleted (hidden)', async () => {
    const { body } = await report(w.user, w.place.id, { reason: 'not_found' });
    await resolve(body.data.id, { action: 'accept' });
    expect((await placeRow(w.place.id)).deleted_at).not.toBeNull();
    expect((await request(app).get(`${api}/places/${w.place.id}`)).status).toBe(404);
  });

  test('reject leaves the place alone; a resolved report cannot be resolved again', async () => {
    const { body } = await report(w.user, w.place.id, { reason: 'closed' });
    const res = await resolve(body.data.id, { action: 'reject' });
    expect(res.body.data.status).toBe('rejected');
    expect((await placeRow(w.place.id)).status).toBe('verified');
    const again = await resolve(body.data.id, { action: 'accept' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('REPORT_ALREADY_RESOLVED');
    expect((await resolve(9999, { action: 'reject' })).status).toBe(404);
    expect((await resolve(body.data.id, { action: 'reject', change: { lat: 20.3, lng: 85.8 } })).status).toBe(400);
  });

  test('accept "duplicate" merges everything into the original and hides the duplicate', async () => {
    const dup = await insertPlace({ areaId: w.area.id, name: 'Dalma Restaurant (2)', lat: 20.2888, lng: 85.8489 });
    await pool.query(`UPDATE places SET status = 'verified', phone = '0674-111' WHERE id = $1`, [dup.id]);
    await insertHours(dup.id, [{ day: 0, opensAt: '10:00', closesAt: '22:00' }]);
    const dupBiryani = await insertMenuItem({ placeId: dup.id, standardDishId: w.biryani.id, name: 'special biryani', price: 300 });
    const chilli = await insertStandardDish({ name: 'Chilli Chicken', diet: 'non_veg' });
    const dupChilli = await insertMenuItem({ placeId: dup.id, standardDishId: chilli.id, name: 'Chilli Chicken', price: 220 });

    const rate = (user, itemId, stars) => request(app).post(`${api}/menu-items/${itemId}/ratings`).set(bearer(user)).send({ stars, wouldOrderAgain: true });
    const oldRating = (await rate(w.user, w.biryaniItem.id, 3)).body.data;
    await backdate('dish_ratings', oldRating.id, '2 days');
    const newRating = (await rate(w.user, dupBiryani.id, 5)).body.data; // newer → stays current
    const raviRating = (await rate(w.other, dupBiryani.id, 4)).body.data;
    await rate(w.other, dupChilli.id, 4);

    const review = (user, placeId, stars, tagIds) => request(app).post(`${api}/places/${placeId}/reviews`).set(bearer(user)).send({ stars, tagIds });
    const workTag = await lookupId('tags', 'Work');
    const oldReview = (await review(w.user, w.place.id, 2, [])).body.data;
    await backdate('place_reviews', oldReview.id, '2 days');
    const newReview = (await review(w.user, dup.id, 4, [workTag])).body.data;
    await review(w.other, w.place.id, 5, [workTag]);
    await review(w.other, dup.id, 5, [workTag]); // newer than Ravi's review of the original
    await pool.query('INSERT INTO photos (url, cloudinary_public_id, place_id) VALUES ($1, $2, $3)', ['https://x/p.jpg', 'khaozo/places/p1', dup.id]);
    await pool.query('INSERT INTO wishlist_items (user_id, place_id) VALUES ($1, $2), ($1, $3), ($4, $3)', [w.user.id, w.place.id, dup.id, w.other.id]);
    await pool.query('INSERT INTO private_notes (user_id, place_id, text) VALUES ($1, $2, $3)', [w.user.id, dup.id, 'Ask for less oil']);

    const { body } = await report(w.user, dup.id, { reason: 'duplicate', duplicateOf: w.place.id });
    const res = await resolve(body.data.id, { action: 'accept' });
    expect(res.status).toBe(200);

    expect((await placeRow(dup.id)).deleted_at).not.toBeNull();
    expect(await placeRow(w.place.id)).toMatchObject({ phone: '0674-111', deleted_at: null });

    // menu: same-name item folded into the original's item; the other one moved over
    const { rows: items } = await pool.query('SELECT id, place_id, status FROM menu_items WHERE id = ANY($1::bigint[]) ORDER BY id', [[dupBiryani.id, dupChilli.id]]);
    expect(items).toEqual([{ id: dupBiryani.id, place_id: w.place.id, status: 'removed' }, { id: dupChilli.id, place_id: w.place.id, status: 'active' }]);
    const { rows: ratings } = await pool.query('SELECT id, menu_item_id, is_current FROM dish_ratings ORDER BY id');
    expect(ratings).toEqual(expect.arrayContaining([
      { id: oldRating.id, menu_item_id: w.biryaniItem.id, is_current: false },
      { id: newRating.id, menu_item_id: w.biryaniItem.id, is_current: true },
      { id: raviRating.id, menu_item_id: w.biryaniItem.id, is_current: true },
    ]));

    // reviews: all on the original, one current per user (the newer one)
    const { rows: reviews } = await pool.query('SELECT id, user_id, is_current FROM place_reviews WHERE place_id = $1 AND is_current ORDER BY user_id', [w.place.id]);
    expect(reviews.map((r) => r.user_id)).toEqual([w.user.id, w.other.id]);
    expect(reviews[0].id).toBe(newReview.id);
    expect((await pool.query('SELECT COUNT(*) AS n FROM place_reviews WHERE place_id = $1', [dup.id])).rows[0].n).toBe(0);

    // tag votes merged without double counting; photo, notes, wishlist, hours moved
    const { rows: votes } = await pool.query('SELECT place_id, user_id FROM place_tag_votes WHERE tag_id = $1 ORDER BY user_id', [workTag]);
    expect(votes).toEqual([{ place_id: w.place.id, user_id: w.user.id }, { place_id: w.place.id, user_id: w.other.id }]);
    expect((await pool.query('SELECT place_id FROM photos')).rows).toEqual([{ place_id: w.place.id }]);
    expect((await pool.query('SELECT place_id FROM private_notes')).rows).toEqual([{ place_id: w.place.id }]);
    const { rows: saved } = await pool.query('SELECT user_id, place_id FROM wishlist_items ORDER BY user_id');
    expect(saved).toEqual([{ user_id: w.user.id, place_id: w.place.id }, { user_id: w.other.id, place_id: w.place.id }]);
    expect((await request(app).get(`${api}/places/${w.place.id}`)).body.data.hours).toEqual([{ day: 0, opensAt: '10:00', closesAt: '22:00' }]);
  });

  test('accept "duplicate" when the original was deleted meanwhile → 400', async () => {
    const dup = await insertPlace({ areaId: w.area.id, name: 'Dalma 2', lat: 20.2888, lng: 85.8489 });
    const { body } = await report(w.user, dup.id, { reason: 'duplicate', duplicateOf: w.place.id });
    await pool.query('UPDATE places SET deleted_at = now() WHERE id = $1', [w.place.id]);
    expect((await resolve(body.data.id, { action: 'accept' })).body.error.code).toBe('DUPLICATE_TARGET_NOT_FOUND');
  });
});

describe('places queue and actions', () => {
  const act = (id, action) => request(app).patch(`${api}/admin/places/${id}`).set(bearer(admin)).send({ action });

  test('unverified queue shows confirmation progress and the adder', async () => {
    const res = await request(app).post(`${api}/places`).set(bearer(w.user)).send({ name: 'New Momo Stall', lat: 20.30, lng: 85.82, placeType: 'street_stall' });
    await request(app).post(`${api}/places/${res.body.data.id}/confirm`).set(bearer(w.other));
    const list = await request(app).get(`${api}/admin/places`).set(bearer(admin));
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0]).toMatchObject({ name: 'New Momo Stall', status: 'unverified', addedByName: 'Asha', confirmations: 0.5 });
  });

  test('verify (admin override) → verified; again → 409', async () => {
    const p = await insertPlace({ areaId: w.area.id, name: 'Unverified Cafe' });
    const res = await act(p.id, 'verify');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('verified');
    expect(res.body.data.verifiedAt).not.toBeNull();
    expect((await act(p.id, 'verify')).body.error.code).toBe('PLACE_ACTION_NOT_APPLICABLE');
  });

  test('close / delete hide the place; restore brings it back', async () => {
    await pool.query('UPDATE places SET verified_at = now() WHERE id = $1', [w.place.id]);
    expect((await act(w.place.id, 'close')).body.data.status).toBe('closed');
    expect((await request(app).get(`${api}/places?lat=20.2887&lng=85.8488`)).body.data.items).toHaveLength(0);
    expect((await request(app).get(`${api}/admin/places?status=closed`).set(bearer(admin))).body.data.items).toHaveLength(1);

    expect((await act(w.place.id, 'delete')).body.data.deletedAt).not.toBeNull();
    expect((await request(app).get(`${api}/places/${w.place.id}`)).status).toBe(404);
    expect((await request(app).get(`${api}/admin/places?status=deleted`).set(bearer(admin))).body.data.items).toHaveLength(1);

    const restored = await act(w.place.id, 'restore');
    expect(restored.body.data).toMatchObject({ status: 'verified', deletedAt: null }); // was verified before → verified
    expect((await request(app).get(`${api}/places/${w.place.id}`)).status).toBe(200);
    expect((await act(w.place.id, 'restore')).status).toBe(409);
    expect((await act(9999, 'close')).status).toBe(404);
  });

  test('a never-verified user place goes back to unverified on restore', async () => {
    const p = await insertPlace({ areaId: w.area.id, name: 'Maybe Real' });
    await act(p.id, 'close');
    expect((await act(p.id, 'restore')).body.data.status).toBe('unverified');
  });
});

describe('dishes', () => {
  const addPending = async (name, placeId = w.place.id) => {
    const categoryId = await lookupId('dish_categories', 'Biryani');
    const cuisineId = await lookupId('cuisines', 'Mughlai');
    const res = await request(app).post(`${api}/places/${placeId}/menu-items`).set(bearer(w.user))
      .send({ name, price: 250, newDish: { categoryId, cuisineId, diet: 'non_veg' } });
    expect(res.status).toBe(201);
    return res.body.data;
  };

  test('pending queue lists user-added dishes with similar active dishes to merge into', async () => {
    const item = await addPending('Chicken Dum Biriyani Special');
    const res = await request(app).get(`${api}/admin/dishes/pending`).set(bearer(admin));
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ id: item.standardDish.id, status: 'pending_review', createdByName: 'Asha', menuItemCount: 1 });
    expect(res.body.data.items[0].similar[0]).toMatchObject({ id: w.biryani.id, name: 'Chicken Dum Biryani' });
  });

  test('approve (with a rename) → active, the typed name kept as an alias', async () => {
    const item = await addPending('Kacchi Biryani');
    const res = await request(app).patch(`${api}/admin/dishes/${item.standardDish.id}`).set(bearer(admin)).send({ action: 'approve', name: 'Kolkata Biryani' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Kolkata Biryani', status: 'active' });
    const match = await request(app).get(`${api}/dishes/match?q=kacchi biryani`);
    expect(match.body.data).toMatchObject({ level: 'exact', match: { id: item.standardDish.id } });
    expect(add).toHaveBeenCalledWith('dishes.embed', {});
    // only pending dishes can be approved
    expect((await request(app).patch(`${api}/admin/dishes/${item.standardDish.id}`).set(bearer(admin)).send({ action: 'approve' })).body.error.code).toBe('DISH_NOT_PENDING');
  });

  test('approve checks names and diet against the main ingredient', async () => {
    const item = await addPending('Kacchi Biryani');
    const url = `${api}/admin/dishes/${item.standardDish.id}`;
    expect((await request(app).patch(url).set(bearer(admin)).send({ action: 'approve', name: 'chicken dum biryani' })).body.error.code).toBe('DISH_NAME_TAKEN');
    const chicken = await lookupId('main_ingredients', 'Chicken');
    expect((await request(app).patch(url).set(bearer(admin)).send({ action: 'approve', mainIngredientId: chicken, diet: 'veg' })).body.error.code).toBe('DIET_INGREDIENT_MISMATCH');
  });

  test('merge moves menu items, aliases and wishlist saves; the merged name becomes an alias', async () => {
    const item = await addPending('Biryani Handi');
    const pendingId = item.standardDish.id;
    await pool.query(`INSERT INTO dish_aliases (alias, standard_dish_id) VALUES ('handi biryani', $1)`, [pendingId]);
    await pool.query('INSERT INTO wishlist_items (user_id, standard_dish_id) VALUES ($1, $2), ($3, $2), ($3, $4)', [w.user.id, pendingId, w.other.id, w.biryani.id]);

    const res = await request(app).patch(`${api}/admin/dishes/${pendingId}`).set(bearer(admin)).send({ action: 'merge', intoId: w.biryani.id });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ mergedDishId: pendingId, menuItemsMoved: 1, aliasesMoved: 1, into: { id: w.biryani.id } });

    expect((await pool.query('SELECT standard_dish_id FROM menu_items WHERE id = $1', [item.id])).rows[0].standard_dish_id).toBe(w.biryani.id);
    const { rows: aliases } = await pool.query('SELECT alias FROM dish_aliases WHERE standard_dish_id = $1 ORDER BY alias', [w.biryani.id]);
    expect(aliases.map((a) => a.alias)).toEqual(['biryani handi', 'handi biryani']);
    expect((await pool.query('SELECT 1 FROM standard_dishes WHERE id = $1', [pendingId])).rowCount).toBe(0);
    const { rows: saved } = await pool.query('SELECT user_id, standard_dish_id FROM wishlist_items ORDER BY user_id');
    expect(saved).toEqual([{ user_id: w.user.id, standard_dish_id: w.biryani.id }, { user_id: w.other.id, standard_dish_id: w.biryani.id }]);
    expect(add).toHaveBeenCalledWith('stats.refresh', {});
  });

  test('merge guards: not into itself, only into an existing active dish', async () => {
    const a = await addPending('Biryani Handi');
    const b = await addPending('Mutton Handi Biryani Royal');
    const url = `${api}/admin/dishes/${a.standardDish.id}`;
    expect((await request(app).patch(url).set(bearer(admin)).send({ action: 'merge', intoId: a.standardDish.id })).body.error.code).toBe('DISH_MERGE_INTO_SELF');
    expect((await request(app).patch(url).set(bearer(admin)).send({ action: 'merge', intoId: b.standardDish.id })).body.error.code).toBe('DISH_MERGE_TARGET_INVALID');
    expect((await request(app).patch(url).set(bearer(admin)).send({ action: 'merge', intoId: 9999 })).body.error.code).toBe('DISH_MERGE_TARGET_INVALID');
    expect((await request(app).patch(`${api}/admin/dishes/9999`).set(bearer(admin)).send({ action: 'approve' })).status).toBe(404);
  });

  test('POST /admin/dishes adds an active dish with aliases', async () => {
    const categoryId = await lookupId('dish_categories', 'Momos');
    const cuisineId = await lookupId('cuisines', 'Chinese');
    const chicken = await lookupId('main_ingredients', 'Chicken');
    const body = { name: 'Chicken Kurkure Momos', categoryId, cuisineId, mainIngredientId: chicken, diet: 'non_veg', aliases: ['kurkure momo', 'Crispy Chicken Momos'] };
    const res = await request(app).post(`${api}/admin/dishes`).set(bearer(admin)).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Chicken Kurkure Momos', status: 'active', category: 'Momos', mainIngredient: 'Chicken' });
    expect((await request(app).get(`${api}/dishes/match?q=crispy chicken momos`)).body.data.match.id).toBe(res.body.data.id);

    expect((await request(app).post(`${api}/admin/dishes`).set(bearer(admin)).send(body)).body.error.code).toBe('DISH_NAME_TAKEN');
    expect((await request(app).post(`${api}/admin/dishes`).set(bearer(admin)).send({ ...body, name: 'Veg Chicken Momos', diet: 'veg' })).body.error.code).toBe('DIET_INGREDIENT_MISMATCH');
  });
});

describe('removing ratings and reviews (soft delete)', () => {
  test('a removed review is hidden from the place but kept in the table', async () => {
    const rv = (await request(app).post(`${api}/places/${w.place.id}/reviews`).set(bearer(w.user)).send({ stars: 1, reviewText: 'spam spam' })).body.data;
    const res = await request(app).delete(`${api}/admin/reviews/${rv.id}`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect((await request(app).get(`${api}/places/${w.place.id}/reviews`)).body.data.items).toHaveLength(0);
    expect((await pool.query('SELECT deleted_at FROM place_reviews WHERE id = $1', [rv.id])).rows[0].deleted_at).not.toBeNull();
    expect((await request(app).delete(`${api}/admin/reviews/${rv.id}`).set(bearer(admin))).status).toBe(404);
    expect(add).toHaveBeenCalledWith('stats.refresh', {});
  });

  test('a removed rating is hidden from the dish page list and the author\'s journal', async () => {
    const r = (await request(app).post(`${api}/menu-items/${w.dalmaItem.id}/ratings`).set(bearer(w.user)).send({ stars: 5, wouldOrderAgain: true })).body.data;
    expect((await request(app).delete(`${api}/admin/ratings/${r.id}`).set(bearer(admin))).status).toBe(200);
    expect((await request(app).get(`${api}/menu-items/${w.dalmaItem.id}/ratings`)).body.data.items).toHaveLength(0);
    expect((await request(app).get(`${api}/me/journal`).set(bearer(w.user))).body.data.items).toHaveLength(0);
    expect((await request(app).delete(`${api}/admin/ratings/${r.id}`).set(bearer(admin))).body.error.code).toBe('RATING_NOT_FOUND');
    // the author can rate the dish again (the removed row no longer blocks the 30-day rule)
    expect((await request(app).post(`${api}/menu-items/${w.dalmaItem.id}/ratings`).set(bearer(w.user)).send({ stars: 4, wouldOrderAgain: true })).status).toBe(201);
  });
});

describe('config editor', () => {
  const patch = (body) => request(app).patch(`${api}/admin/config`).set(bearer(admin)).send(body);

  // config_settings is not emptied between test files → put the original values back
  let original;
  beforeAll(async () => {
    original = (await pool.query('SELECT key, value FROM config_settings')).rows;
  });
  afterEach(async () => {
    for (const { key, value } of original) {
      await pool.query('UPDATE config_settings SET value = $2::jsonb, updated_by = NULL WHERE key = $1', [key, JSON.stringify(value)]);
    }
    await resetCache();
  });

  test('lists every setting with its description', async () => {
    const res = await request(app).get(`${api}/admin/config`).set(bearer(admin));
    const threshold = res.body.data.find((c) => c.key === 'place_verify_threshold');
    expect(threshold).toMatchObject({ value: 5, description: expect.any(String), updatedBy: null });
  });

  test('edit saves the value + who changed it, and clears the config cache', async () => {
    expect(await configService.get('place_verify_threshold')).toBe(5); // now cached
    const res = await patch({ key: 'place_verify_threshold', value: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ key: 'place_verify_threshold', value: 3, updatedBy: admin.id });
    expect(await configService.get('place_verify_threshold')).toBe(3);

    const weights = { new: 0.5, normal: 1, trusted: 3 };
    expect((await patch({ key: 'trust_weights', value: weights })).body.data.value).toEqual(weights);
    const listed = await request(app).get(`${api}/admin/config`).set(bearer(admin));
    expect(listed.body.data.find((c) => c.key === 'trust_weights')).toMatchObject({ updatedByName: 'Admin' });
  });

  test('the value must keep the setting\'s shape', async () => {
    const bad = [
      { key: 'place_verify_threshold', value: 'five' },
      { key: 'place_verify_threshold', value: -1 },
      { key: 'trust_weights', value: { new: 0.5, normal: 1 } },
      { key: 'trust_weights', value: { new: 0.5, normal: 1, trusted: 2, admin: 9 } },
      { key: 'rate_limits', value: { api: { user: [120] } } },
    ];
    for (const body of bad) {
      const res = await patch(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CONFIG_VALUE_INVALID');
    }
    expect((await patch({ key: 'no_such_setting', value: 1 })).status).toBe(404);
    expect((await patch({ key: 'place_verify_threshold' })).status).toBe(400);
  });
});
