import { pool } from '../../src/config/db.js';
import { runJob } from '../../src/jobs/index.js';
import { JOBS } from '../../src/services/helpers/jobQueue.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, resetCache, insertUser, insertPlace, ageUser } from '../helpers/db.js';
import { world, setCreatedAt } from '../helpers/fixtures.js';

let w;
beforeEach(async () => {
  await resetData();
  await resetCache();
  w = await world();
  await pool.query('INSERT INTO taste_profiles (user_id) VALUES ($1), ($2)', [w.user.id, w.other.id]);
});
afterAll(closeConnections);

const tagVotes = async () =>
  (await pool.query(
    `SELECT t.name, v.source, v.user_id FROM place_tag_votes v JOIN tags t ON t.id = v.tag_id WHERE v.place_id = $1 ORDER BY t.name`,
    [w.place.id],
  )).rows;

describe('auto tag votes (code rules)', () => {
  test('quiet + Wi-Fi + plug points → Work (source auto)', async () => {
    const { rows } = await pool.query(
      `INSERT INTO place_reviews (user_id, place_id, stars, noise, wifi, plug_points) VALUES ($1, $2, 4, 'quiet', true, true) RETURNING id`,
      [w.user.id, w.place.id],
    );
    await runJob(JOBS.AUTO_TAGS, { kind: 'review', id: rows[0].id });
    expect(await tagVotes()).toEqual([{ name: 'Work', source: 'auto', user_id: w.user.id }]);
  });

  test('good vibe + looks + moderate noise → Date; missing Wi-Fi → no Work', async () => {
    const { rows } = await pool.query(
      `INSERT INTO place_reviews (user_id, place_id, stars, noise, vibe, looks, plug_points) VALUES ($1, $2, 5, 'moderate', 5, 4, true) RETURNING id`,
      [w.user.id, w.place.id],
    );
    await runJob(JOBS.AUTO_TAGS, { kind: 'review', id: rows[0].id });
    expect((await tagVotes()).map((t) => t.name)).toEqual(['Date']);
  });

  test('dish rated 7–11 AM → Breakfast; a user tick for the same tag is not duplicated', async () => {
    const { rows } = await pool.query(
      `INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again) VALUES ($1, $2, 4, true) RETURNING id`,
      [w.user.id, w.dalmaItem.id],
    );
    await setCreatedAt('dish_ratings', rows[0].id, '2026-09-20T08:15:00+05:30');
    const breakfast = (await pool.query(`SELECT id FROM tags WHERE name = 'Breakfast'`)).rows[0].id;
    await pool.query(`INSERT INTO place_tag_votes (place_id, tag_id, user_id, source) VALUES ($1, $2, $3, 'user')`, [w.place.id, breakfast, w.user.id]);
    await runJob(JOBS.AUTO_TAGS, { kind: 'rating', id: rows[0].id });
    expect(await tagVotes()).toEqual([{ name: 'Breakfast', source: 'user', user_id: w.user.id }]);
  });
});

describe('taste learning', () => {
  const rateWith = async (stars, spice, pricePaid) => {
    await pool.query(
      'INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, spice, price_paid, is_current) VALUES ($1, $2, $3, true, $4, $5, false)',
      [w.user.id, w.biryaniItem.id, stars, spice, pricePaid],
    );
  };

  test('learns spice + budget from liked dishes (4★+) only', async () => {
    await rateWith(5, 'very_spicy', 280); // spice 4, budget 2
    await rateWith(4, 'spicy', 650);      // spice 3, budget 4
    await rateWith(2, 'mild', 90);        // disliked → ignored
    await runJob(JOBS.LEARN_TASTE, { userId: w.user.id });
    const { rows } = await pool.query('SELECT spice_learned, budget_learned, ratings_used FROM taste_profiles WHERE user_id = $1', [w.user.id]);
    expect(rows[0]).toEqual({ spice_learned: 3.5, budget_learned: 3, ratings_used: 2 });
  });

  test('skips locked fields (the user\'s own edit wins)', async () => {
    await pool.query('UPDATE taste_profiles SET spice_learned = 1, spice_locked = true WHERE user_id = $1', [w.user.id]);
    await rateWith(5, 'very_spicy', 280);
    await runJob(JOBS.LEARN_TASTE, { userId: w.user.id });
    const { rows } = await pool.query('SELECT spice_learned, budget_learned FROM taste_profiles WHERE user_id = $1', [w.user.id]);
    expect(rows[0]).toEqual({ spice_learned: 1, budget_learned: 2 });
  });
});

describe('trust score recalculation', () => {
  test('agreeing with the crowd raises trust, far-off ratings lower it', async () => {
    const crowd = [];
    for (let i = 0; i < 5; i += 1) {
      const u = await insertUser();
      await ageUser(u.id, 60);
      crowd.push(u);
      await pool.query('INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again) VALUES ($1, $2, 5, true)', [u.id, w.dalmaItem.id]);
    }
    await pool.query('INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again) VALUES ($1, $2, 5, true)', [w.user.id, w.dalmaItem.id]);
    await pool.query('INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again) VALUES ($1, $2, 1, false)', [w.other.id, w.dalmaItem.id]);

    await runJob(JOBS.TRUST_SCORES, {});
    const trust = async (id) => (await pool.query('SELECT trust_score FROM users WHERE id = $1', [id])).rows[0].trust_score;
    expect(await trust(w.user.id)).toBeCloseTo(1.05, 3);  // 1 agreeing rating
    expect(await trust(w.other.id)).toBeCloseTo(0.8, 3);  // 1 far-off rating (1★ vs crowd 5★)
  });

  test('places a user added that got verified add trust', async () => {
    const p = await insertPlace({ areaId: w.area.id, name: 'Verified Stall' });
    await pool.query(`UPDATE places SET added_by = $1, status = 'verified' WHERE id = $2`, [w.user.id, p.id]);
    await runJob(JOBS.TRUST_SCORES, {});
    const { rows } = await pool.query('SELECT trust_score FROM users WHERE id = $1', [w.user.id]);
    expect(rows[0].trust_score).toBeCloseTo(1.1, 3);
  });
});

describe('session cleanup', () => {
  test('deletes only expired sessions', async () => {
    await pool.query(
      `INSERT INTO login_sessions (user_id, token_hash, expires_at) VALUES ($1, 'a', now() - interval '1 day'), ($1, 'b', now() + interval '1 day')`,
      [w.user.id],
    );
    expect(await runJob(JOBS.SESSION_CLEANUP, {})).toEqual({ deleted: 1 });
    const { rows } = await pool.query('SELECT token_hash FROM login_sessions');
    expect(rows).toEqual([{ token_hash: 'b' }]);
  });
});

test('unknown job name fails loudly', async () => {
  await expect(runJob('nope', {})).rejects.toThrow('Unknown job');
});
