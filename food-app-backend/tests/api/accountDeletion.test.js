import { jest } from '@jest/globals';

// ---- Mock Cloudinary (no network) and the job queue (see what gets queued)
const destroy = jest.fn(async () => ({ result: 'ok' }));
jest.unstable_mockModule('cloudinary', () => ({
  v2: { config: jest.fn(), uploader: { upload_stream: jest.fn(), destroy } },
}));
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
const { closeConnections } = await import('../helpers/connections.js');
const { resetData, resetCache, insertPlace, insertStandardDish, lookupId } = await import('../helpers/db.js');
const { world, bearer } = await import('../helpers/fixtures.js');

const app = createApp();
const api = '/api/v1';
let w;
let asha; // the user who deletes her account
let s;    // ids of everything she created

const count = async (sql, params) => (await pool.query(sql, params)).rows[0].n;
const vector = `[${Array(768).fill(0.01).join(',')}]`;

// Asha uses every feature once; Ravi (w.other) has his own data that must stay untouched.
const seedAshaEverywhere = async () => {
  const q = (sql, params) => pool.query(sql, params).then((r) => r.rows[0]);
  asha = w.user;
  await pool.query('INSERT INTO taste_profiles (user_id, diet) VALUES ($1, $2), ($3, $2)', [asha.id, 'non_veg', w.other.id]);
  await pool.query('INSERT INTO taste_profile_cuisines (user_id, cuisine_id) VALUES ($1, $2)', [asha.id, await lookupId('cuisines', 'Odia')]);
  await pool.query('INSERT INTO taste_profile_avoid (user_id, main_ingredient_id) VALUES ($1, $2)', [asha.id, await lookupId('main_ingredients', 'Prawn')]);
  await pool.query(`INSERT INTO login_sessions (user_id, token_hash, expires_at) VALUES ($1, 'h1', now() + interval '7 days'), ($2, 'h2', now() + interval '7 days')`, [asha.id, w.other.id]);

  const rating = await q(`INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, review_text, price_paid) VALUES ($1, $2, 5, true, 'Asha loved it', 260) RETURNING id`, [asha.id, w.biryaniItem.id]);
  const raviRating = await q(`INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, review_text) VALUES ($1, $2, 4, true, 'Ravi says good') RETURNING id`, [w.other.id, w.biryaniItem.id]);
  const review = await q(`INSERT INTO place_reviews (user_id, place_id, stars, review_text, text_embedding, wifi) VALUES ($1, $2, 4, 'Cozy, Asha was here', $3::vector, true) RETURNING id`, [asha.id, w.place.id, vector]);
  const workTag = await lookupId('tags', 'Work');
  await pool.query(`INSERT INTO place_tag_votes (place_id, tag_id, user_id, source) VALUES ($1, $2, $3, 'user'), ($1, $2, $4, 'user')`, [w.place.id, workTag, asha.id, w.other.id]);

  // A place she added (with a photo), a menu item and a dish she added
  const added = await insertPlace({ areaId: w.area.id, name: 'Asha Momo Point', lat: 20.30, lng: 85.82 });
  await pool.query('UPDATE places SET added_by = $1 WHERE id = $2', [asha.id, added.id]);
  const menuItem = await q('INSERT INTO menu_items (place_id, standard_dish_id, name, added_by) VALUES ($1, $2, $3, $4) RETURNING id', [added.id, w.dalma.id, 'Dalma', asha.id]);
  const dish = await insertStandardDish({ name: 'Asha Special Pitha', diet: 'veg' });
  await pool.query(`UPDATE standard_dishes SET created_by = $1, status = 'pending_review' WHERE id = $2`, [asha.id, dish.id]);

  await pool.query(
    `INSERT INTO photos (url, cloudinary_public_id, dish_rating_id, place_review_id, place_id) VALUES
       ('https://x/r.jpg', 'khaozo/ratings/r1', $1, NULL, NULL),
       ('https://x/v.jpg', 'khaozo/reviews/v1', NULL, $2, NULL),
       ('https://x/p.jpg', 'khaozo/places/p1', NULL, NULL, $3),
       ('https://x/o.jpg', 'khaozo/ratings/ravi', $4, NULL, NULL)`,
    [rating.id, review.id, added.id, raviRating.id],
  );

  // Ravi's place, verified thanks to Asha's confirmation
  const raviPlace = await insertPlace({ areaId: w.area.id, name: 'Ravi Chai', lat: 20.31, lng: 85.81 });
  await pool.query(`UPDATE places SET added_by = $1, status = 'verified', verified_at = now() WHERE id = $2`, [w.other.id, raviPlace.id]);
  await pool.query('INSERT INTO place_confirmations (place_id, confirmed_by, weight) VALUES ($1, $2, 5)', [raviPlace.id, asha.id]);

  const report = await q(`INSERT INTO place_reports (place_id, reported_by, reason, details) VALUES ($1, $2, 'wrong_info', 'Asha noticed') RETURNING id`, [w.place.id, asha.id]);
  await pool.query('INSERT INTO private_notes (user_id, place_id, text) VALUES ($1, $2, $3), ($4, $2, $5)', [asha.id, w.place.id, 'Asha private note', w.other.id, 'Ravi note']);
  await pool.query('INSERT INTO wishlist_items (user_id, place_id) VALUES ($1, $2), ($3, $2)', [asha.id, w.place.id, w.other.id]);

  const group = await q(
    `INSERT INTO group_sessions (code, created_by, winning_place_id, guest_count, started_at, ended_at)
     VALUES ('ASHA22', $1, $2, 1, now() - interval '1 hour', now()) RETURNING id`,
    [asha.id, w.place.id],
  );
  await pool.query('INSERT INTO group_session_members (group_session_id, user_id, joined_at) VALUES ($1, $2, now()), ($1, $3, now())', [group.id, asha.id, w.other.id]);
  await pool.query(`UPDATE config_settings SET updated_by = $1 WHERE key = 'journal_gap_hours'`, [asha.id]);

  s = { rating, raviRating, review, added, menuItem, dish, raviPlace, report, group };
};

beforeEach(async () => {
  await resetData();
  await resetCache();
  destroy.mockClear();
  destroy.mockImplementation(async () => ({ result: 'ok' }));
  add.mockClear();
  w = await world();
  await seedAshaEverywhere();
});
afterAll(closeConnections);

const deleteMe = (user, body = { confirm: 'DELETE' }) => request(app).delete(`${api}/me`).set(bearer(user)).send(body);

describe('DELETE /me (DPDP account deletion)', () => {
  test('needs { confirm: "DELETE" } and a login', async () => {
    expect((await deleteMe(asha, {})).status).toBe(400);
    expect((await deleteMe(asha, { confirm: 'delete' })).status).toBe(400);
    expect((await request(app).delete(`${api}/me`).send({ confirm: 'DELETE' })).status).toBe(401);
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE id = $1', [asha.id])).toBe(1);
  });

  test('every table follows its rule', async () => {
    const res = await deleteMe(asha);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ deleted: true, photosDeleted: 3, ratingsKeptAnonymous: 1, reviewsKeptAnonymous: 1 });

    // users row + CASCADE tables
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE id = $1', [asha.id])).toBe(0);
    for (const table of ['taste_profiles', 'taste_profile_cuisines', 'taste_profile_avoid', 'login_sessions', 'private_notes', 'wishlist_items', 'place_tag_votes', 'group_session_members']) {
      expect([table, await count(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = $1`, [asha.id])]).toEqual([table, 0]);
    }
    expect(await count('SELECT COUNT(*) AS n FROM place_confirmations WHERE confirmed_by = $1', [asha.id])).toBe(0);

    // ratings / reviews: kept, anonymous, text (+ embedding) gone, numbers kept
    const { rows: [r] } = await pool.query('SELECT user_id, stars, would_order_again, review_text, price_paid FROM dish_ratings WHERE id = $1', [s.rating.id]);
    expect(r).toEqual({ user_id: null, stars: 5, would_order_again: true, review_text: null, price_paid: 260 });
    const { rows: [v] } = await pool.query('SELECT user_id, stars, wifi, review_text, text_embedding FROM place_reviews WHERE id = $1', [s.review.id]);
    expect(v).toEqual({ user_id: null, stars: 4, wifi: true, review_text: null, text_embedding: null });

    // her photos: rows gone + files removed from Cloudinary; Ravi's photo untouched
    expect((await pool.query('SELECT cloudinary_public_id FROM photos')).rows).toEqual([{ cloudinary_public_id: 'khaozo/ratings/ravi' }]);
    expect(destroy.mock.calls.map((c) => c[0]).sort()).toEqual(['khaozo/places/p1', 'khaozo/ratings/r1', 'khaozo/reviews/v1']);

    // SET NULL pointers: things she added stay, without her name on them
    expect((await pool.query('SELECT added_by FROM places WHERE id = $1', [s.added.id])).rows[0].added_by).toBeNull();
    expect((await pool.query('SELECT added_by FROM menu_items WHERE id = $1', [s.menuItem.id])).rows[0].added_by).toBeNull();
    expect((await pool.query('SELECT created_by FROM standard_dishes WHERE id = $1', [s.dish.id])).rows[0].created_by).toBeNull();
    expect((await pool.query('SELECT reported_by FROM place_reports WHERE id = $1', [s.report.id])).rows[0].reported_by).toBeNull();
    expect((await pool.query('SELECT created_by, guest_count FROM group_sessions WHERE id = $1', [s.group.id])).rows[0]).toEqual({ created_by: null, guest_count: 1 });
    expect((await pool.query(`SELECT updated_by, value FROM config_settings WHERE key = 'journal_gap_hours'`)).rows[0]).toEqual({ updated_by: null, value: 3 });

    // places she helped verify stay verified
    expect((await pool.query('SELECT status FROM places WHERE id = $1', [s.raviPlace.id])).rows[0].status).toBe('verified');

    // Ravi's data is untouched
    expect((await pool.query('SELECT user_id, review_text FROM dish_ratings WHERE id = $1', [s.raviRating.id])).rows[0]).toEqual({ user_id: w.other.id, review_text: 'Ravi says good' });
    for (const table of ['taste_profiles', 'login_sessions', 'private_notes', 'wishlist_items', 'place_tag_votes', 'group_session_members']) {
      expect([table, await count(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = $1`, [w.other.id])]).toEqual([table, 1]);
    }

    // rankings recalculated with her ratings now counted as anonymous
    expect(add).toHaveBeenCalledWith('stats.refresh', {});
    expect(add).not.toHaveBeenCalledWith('photos.delete', expect.anything());
  });

  test('logged out: refresh cookie cleared; old access token finds no user', async () => {
    const res = await deleteMe(asha);
    const cookie = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='));
    expect(cookie).toMatch(/refresh_token=;/);
    expect((await request(app).get(`${api}/me`).set(bearer(asha))).status).toBe(404);
    expect((await deleteMe(asha)).body.error.code).toBe('USER_NOT_FOUND');
  });

  test('anonymous ratings / reviews still show (without a name) and still count', async () => {
    await deleteMe(asha);
    const ratings = await request(app).get(`${api}/menu-items/${w.biryaniItem.id}/ratings`);
    expect(ratings.body.data.items).toHaveLength(2);
    const anon = ratings.body.data.items.find((i) => i.id === s.rating.id);
    expect(anon).toMatchObject({ userId: null, userName: null, reviewText: null, stars: 5, photos: [] });
  });

  test('Cloudinary down → DB erasure still done; failed files retried by a job', async () => {
    destroy.mockImplementation(async (publicId) => {
      if (publicId === 'khaozo/places/p1') throw new Error('Cloudinary timeout');
      return { result: 'ok' };
    });
    const res = await deleteMe(asha);
    expect(res.status).toBe(200);
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE id = $1', [asha.id])).toBe(0);
    expect(add).toHaveBeenCalledWith('photos.delete', { publicIds: ['khaozo/places/p1'] });
  });

  test('a failed transaction deletes nothing — not even the Cloudinary files', async () => {
    // Make the final DELETE fail: a temporary RESTRICT FK pointing at users
    await pool.query('CREATE TABLE block_delete (user_id BIGINT REFERENCES users (id) ON DELETE RESTRICT)');
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {}); // the expected 500 is logged
    try {
      await pool.query('INSERT INTO block_delete VALUES ($1)', [asha.id]);
      const res = await deleteMe(asha);
      expect(res.status).toBe(500);
      expect(destroy).not.toHaveBeenCalled();
      expect(await count('SELECT COUNT(*) AS n FROM users WHERE id = $1', [asha.id])).toBe(1);
      expect(await count('SELECT COUNT(*) AS n FROM photos', [])).toBe(4);
      expect((await pool.query('SELECT review_text FROM dish_ratings WHERE id = $1', [s.rating.id])).rows[0].review_text).toBe('Asha loved it');
    } finally {
      quiet.mockRestore();
      await pool.query('DROP TABLE block_delete');
    }
  });
});

describe('photos.delete job', () => {
  test('throws while a file is still there (so BullMQ retries), succeeds once all are gone', async () => {
    const { runJob } = await import('../../src/jobs/index.js');
    destroy.mockImplementationOnce(async () => { throw new Error('still down'); });
    await expect(runJob('photos.delete', { publicIds: ['a', 'b'] })).rejects.toThrow(/Could not delete 1/);
    await expect(runJob('photos.delete', { publicIds: ['a', 'b'] })).resolves.toEqual({ deleted: 2 });
  });
});
