import { jest } from '@jest/globals';

// Replace the queue so we can see exactly what gets queued (and when).
const add = jest.fn(async () => true);
jest.unstable_mockModule('../../src/services/helpers/jobQueue.js', () => ({
  add,
  close: async () => {},
  JOBS: { LEARN_TASTE: 'taste.learn', AUTO_TAGS: 'tags.auto', REFRESH_STATS: 'stats.refresh', TRUST_SCORES: 'trust.recalculate', SESSION_CLEANUP: 'sessions.cleanup' },
}));

const ratingRepo = await import('../../src/repositories/rating.repo.js');
const ratingService = await import('../../src/services/rating.service.js');
const reviewService = await import('../../src/services/review.service.js');
const { pool } = await import('../../src/config/db.js');
const { closeConnections } = await import('../helpers/connections.js');
const { resetData, resetCache } = await import('../helpers/db.js');
const { world } = await import('../helpers/fixtures.js');

let w;
beforeEach(async () => {
  await resetData();
  await resetCache();
  add.mockClear();
  w = await world();
});
afterAll(closeConnections);

test('rating: jobs are queued after the rating is saved', async () => {
  const result = await ratingService.create({ userId: w.user.id, menuItemId: w.dalmaItem.id, stars: 5, wouldOrderAgain: true });
  expect(result.ok).toBe(true);
  expect(add.mock.calls).toEqual([
    ['taste.learn', { userId: w.user.id }],
    ['tags.auto', { kind: 'rating', id: result.data.id }],
  ]);
  // the row was committed before the job was queued
  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM dish_ratings WHERE id = $1', [result.data.id]);
  expect(rows[0].n).toBe(1);
});

test('rating: nothing is queued when the transaction fails', async () => {
  await expect(ratingRepo.replaceCurrent(w.user.id, w.dalmaItem.id, { stars: 9, wouldOrderAgain: true })).rejects.toThrow();
  await expect(ratingService.create({ userId: w.user.id, menuItemId: w.dalmaItem.id, stars: 9, wouldOrderAgain: true })).rejects.toThrow();
  expect(add).not.toHaveBeenCalled();
});

test('rating rejected by a rule (too soon) queues nothing', async () => {
  await ratingService.create({ userId: w.user.id, menuItemId: w.dalmaItem.id, stars: 5, wouldOrderAgain: true });
  add.mockClear();
  const again = await ratingService.create({ userId: w.user.id, menuItemId: w.dalmaItem.id, stars: 4, wouldOrderAgain: true });
  expect(again).toMatchObject({ ok: false, reason: 'RATING_TOO_SOON' });
  expect(add).not.toHaveBeenCalled();
});

test('review: auto-tag job queued after commit', async () => {
  const result = await reviewService.create({ userId: w.user.id, placeId: w.place.id, stars: 4, noise: 'quiet' });
  expect(add.mock.calls).toEqual([['tags.auto', { kind: 'review', id: result.data.id }]]);
});
