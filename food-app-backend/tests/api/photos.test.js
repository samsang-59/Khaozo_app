import { jest } from '@jest/globals';

// ---- Mock Cloudinary (no network, no account)
let uploadCount = 0;
const destroy = jest.fn(async () => ({ result: 'ok' }));
const upload_stream = jest.fn((options, callback) => ({
  end: () => {
    uploadCount += 1;
    callback(null, { secure_url: `https://res.cloudinary.com/demo/${options.folder}/p${uploadCount}.jpg`, public_id: `${options.folder}/p${uploadCount}` });
  },
}));
jest.unstable_mockModule('cloudinary', () => ({
  v2: { config: jest.fn(), uploader: { upload_stream, destroy } },
}));

const { default: request } = await import('supertest');
const { createApp } = await import('../../src/app.js');
const { pool } = await import('../../src/config/db.js');
const { closeConnections } = await import('../helpers/connections.js');
const { resetData, resetCache } = await import('../helpers/db.js');
const { world, bearer } = await import('../helpers/fixtures.js');

const app = createApp();
const api = '/api/v1';
let w;
let ratingId;

// A tiny valid-looking JPEG header + padding
const jpeg = (bytes = 1024) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(bytes)]);

beforeEach(async () => {
  await resetData();
  await resetCache();
  destroy.mockClear();
  upload_stream.mockClear();
  w = await world();
  const res = await request(app).post(`${api}/menu-items/${w.biryaniItem.id}/ratings`).set(bearer(w.user)).send({ stars: 5, wouldOrderAgain: true });
  ratingId = res.body.data.id;
});
afterAll(closeConnections);

const upload = (user, path, files) => {
  let req = request(app).post(`${api}${path}`).set(bearer(user));
  for (const f of files) req = req.attach('photos', f.buffer, { filename: f.name, contentType: f.type });
  return req;
};
const img = (name = 'a.jpg', bytes) => ({ buffer: jpeg(bytes), name, type: 'image/jpeg' });

describe('photo uploads', () => {
  test('uploads to Cloudinary and stores only url + public id', async () => {
    const res = await upload(w.user, `/ratings/${ratingId}/photos`, [img(), img('b.jpg')]);
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].url).toMatch(/^https:\/\/res\.cloudinary\.com\/demo\/khaozo\/ratings\//);
    expect(upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'khaozo/ratings', resource_type: 'image' }),
      expect.any(Function),
    );
    const { rows } = await pool.query('SELECT dish_rating_id, cloudinary_public_id FROM photos');
    expect(rows.every((r) => r.dish_rating_id === ratingId && r.cloudinary_public_id.startsWith('khaozo/ratings/'))).toBe(true);
  });

  test('max 3 per rating: a 4th file in one request or across requests is rejected', async () => {
    expect((await upload(w.user, `/ratings/${ratingId}/photos`, [img(), img(), img(), img()])).body.error.code).toBe('TOO_MANY_PHOTOS');
    expect((await upload(w.user, `/ratings/${ratingId}/photos`, [img(), img()])).status).toBe(201);
    const third = await upload(w.user, `/ratings/${ratingId}/photos`, [img(), img()]);
    expect(third.body.error.code).toBe('TOO_MANY_PHOTOS');
    expect(upload_stream).toHaveBeenCalledTimes(2); // nothing uploaded for the rejected requests
  });

  test('images only', async () => {
    const res = await upload(w.user, `/ratings/${ratingId}/photos`, [{ buffer: Buffer.from('hello'), name: 'notes.txt', type: 'text/plain' }]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_AN_IMAGE');
  });

  test('5 MB limit per photo', async () => {
    const res = await upload(w.user, `/ratings/${ratingId}/photos`, [img('big.jpg', 5 * 1024 * 1024 + 10)]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PHOTO_TOO_LARGE');
  });

  test('no files → 400; someone else\'s rating → 403', async () => {
    expect((await request(app).post(`${api}/ratings/${ratingId}/photos`).set(bearer(w.user))).body.error.code).toBe('NO_PHOTOS');
    expect((await upload(w.other, `/ratings/${ratingId}/photos`, [img()])).status).toBe(403);
  });

  test('place photos only by the person who added the place', async () => {
    await pool.query('UPDATE places SET added_by = $1 WHERE id = $2', [w.user.id, w.place.id]);
    expect((await upload(w.other, `/places/${w.place.id}/photos`, [img()])).status).toBe(403);
    expect((await upload(w.user, `/places/${w.place.id}/photos`, [img()])).status).toBe(201);
  });

  test('DELETE /photos/:id removes the Cloudinary file too (owner only)', async () => {
    const { body } = await upload(w.user, `/ratings/${ratingId}/photos`, [img()]);
    const photoId = body.data[0].id;
    expect((await request(app).delete(`${api}/photos/${photoId}`).set(bearer(w.other))).status).toBe(403);
    expect((await request(app).delete(`${api}/photos/${photoId}`).set(bearer(w.user))).status).toBe(200);
    expect(destroy).toHaveBeenCalledWith('khaozo/ratings/' + body.data[0].url.split('/').pop().replace('.jpg', ''), expect.any(Object));
  });

  test('deleting a rating deletes its photos on Cloudinary', async () => {
    await upload(w.user, `/ratings/${ratingId}/photos`, [img(), img()]);
    await request(app).delete(`${api}/ratings/${ratingId}`).set(bearer(w.user));
    expect(destroy).toHaveBeenCalledTimes(2);
    expect((await pool.query('SELECT COUNT(*) AS n FROM photos')).rows[0].n).toBe(0);
  });

  test('place gallery shows place, review and rating photos', async () => {
    await upload(w.user, `/ratings/${ratingId}/photos`, [img()]);
    const res = await request(app).get(`${api}/places/${w.place.id}/photos`);
    expect(res.body.data.items).toEqual([expect.objectContaining({ source: 'rating', menuItemName: 'Special Biryani' })]);
  });
});
