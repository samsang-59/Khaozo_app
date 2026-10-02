import { jest } from '@jest/globals';

let chatResult = { ok: true, data: { summary: 'Rich, spicy and generous; most would order again.' }, provider: 'gemini' };
const chat = jest.fn(async () => chatResult);
let embedImpl = async () => null;
const embed = jest.fn((...args) => embedImpl(...args));
jest.unstable_mockModule('../../src/ai/aiAdapter.js', () => ({ chat, embed, isEnabled: () => true, EMBED_DIMENSIONS: 768 }));

const { pool } = await import('../../src/config/db.js');
const { runJob } = await import('../../src/jobs/index.js');
const { JOBS } = await import('../../src/services/helpers/jobQueue.js');
const ranking = await import('../../src/services/helpers/ranking.js');
const dishMatcher = await import('../../src/services/helpers/dishMatcher.js');
const { closeConnections } = await import('../helpers/connections.js');
const { resetData, resetCache, insertUser, ageUser } = await import('../helpers/db.js');
const { world } = await import('../helpers/fixtures.js');

const oneHot = (i) => {
  const v = Array(768).fill(0);
  v[i] = 1;
  return v;
};

let w;
beforeEach(async () => {
  await resetData();
  await resetCache();
  chat.mockClear();
  embed.mockClear();
  w = await world();
});
afterAll(closeConnections);

describe('dish embeddings', () => {
  test('sweep embeds every dish without one', async () => {
    embedImpl = async () => oneHot(0);
    expect(await runJob(JOBS.EMBED_DISHES, {})).toEqual({ embedded: 2, remaining: 0 });
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM standard_dishes WHERE embedding IS NULL');
    expect(rows[0].n).toBe(0);
  });

  test('AI unavailable → stops, next run continues', async () => {
    embedImpl = async () => null;
    expect(await runJob(JOBS.EMBED_DISHES, {})).toEqual({ embedded: 0, remaining: 2 });
  });

  test('dishMatcher falls back to meaning when spelling does not help', async () => {
    await pool.query('UPDATE standard_dishes SET embedding = $2::vector WHERE id = $1', [w.biryani.id, JSON.stringify(oneHot(3))]);
    await pool.query('UPDATE standard_dishes SET embedding = $2::vector WHERE id = $1', [w.dalma.id, JSON.stringify(oneHot(7))]);
    embedImpl = async () => oneHot(3);
    const m = await dishMatcher.match('zqx pulao rice thing');
    expect(m).toMatchObject({ level: 'similar', via: 'embedding' });
    expect(m.candidates.map((c) => c.name)).toEqual(['Chicken Dum Biryani']);
  });
});

describe('review embeddings', () => {
  test('review text → embedding stored', async () => {
    embedImpl = async () => oneHot(5);
    const { rows } = await pool.query(`INSERT INTO place_reviews (user_id, place_id, stars, review_text) VALUES ($1, $2, 4, 'Warm and comfortable') RETURNING id`, [w.user.id, w.place.id]);
    expect(await runJob(JOBS.EMBED_REVIEW, { reviewId: rows[0].id })).toEqual({ embedded: true });
    expect(embed).toHaveBeenCalledWith('Warm and comfortable', 'RETRIEVAL_DOCUMENT');
    const r = await pool.query('SELECT text_embedding IS NOT NULL AS has FROM place_reviews WHERE id = $1', [rows[0].id]);
    expect(r.rows[0].has).toBe(true);
  });
});

describe('AI one-line summaries', () => {
  const labelDalma = async (withText = true) => {
    for (let i = 0; i < 5; i += 1) {
      const u = await insertUser({ name: `Reviewer ${i}`, email: `secret${i}@example.com` });
      await ageUser(u.id, 60);
      await pool.query(
        'INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, review_text) VALUES ($1, $2, 5, true, $3)',
        [u.id, w.dalmaItem.id, withText ? `Lovely dalma, visit ${i}` : null],
      );
    }
    await ranking.refreshStats();
  };

  test('labelled dish → summary written; prompt carries no names or emails', async () => {
    await labelDalma();
    expect(await runJob(JOBS.SUMMARY, { menuItemId: w.dalmaItem.id })).toMatchObject({ updated: true });
    const { rows } = await pool.query('SELECT ai_summary, summary_updated_at FROM menu_items WHERE id = $1', [w.dalmaItem.id]);
    expect(rows[0].ai_summary).toBe('Rich, spicy and generous; most would order again.');
    const sent = JSON.stringify(chat.mock.calls[0][0]);
    expect(sent).toContain('Lovely dalma');
    expect(sent).not.toMatch(/Reviewer|@example\.com/);
  });

  test('not refreshed again until 5 new text reviews', async () => {
    await labelDalma();
    await runJob(JOBS.SUMMARY, { menuItemId: w.dalmaItem.id });
    expect(await runJob(JOBS.SUMMARY, { menuItemId: w.dalmaItem.id })).toMatchObject({ updated: false, why: 'not due' });
  });

  test('unlabelled dish or AI down → no summary', async () => {
    expect(await runJob(JOBS.SUMMARY, { menuItemId: w.biryaniItem.id })).toMatchObject({ updated: false });
    await labelDalma();
    chatResult = { ok: false, reason: 'AI_UNAVAILABLE' };
    expect(await runJob(JOBS.SUMMARY, { menuItemId: w.dalmaItem.id })).toMatchObject({ updated: false, why: 'AI unavailable' });
    chatResult = { ok: true, data: { summary: 'x'.repeat(10) }, provider: 'gemini' };
  });
});
