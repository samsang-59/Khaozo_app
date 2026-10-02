// Constraints must reject bad data at the DB level (07_testing_plan.md, Phase 1).
import { pool } from '../../src/config/db.js';
import { closeConnections } from '../helpers/connections.js';
import {
  resetData, insertUser, insertArea, insertPlace, insertStandardDish, insertMenuItem, ensureLookup,
} from '../helpers/db.js';

// Postgres error codes
const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const NOT_NULL_VIOLATION = '23502';
const FK_VIOLATION = '23503';

const expectPgError = async (promise, code) => {
  await expect(promise).rejects.toMatchObject({ code });
};

let user;
let area;
let place;
let menuItem;

beforeEach(async () => {
  await resetData();
  user = await insertUser();
  area = await insertArea({ name: 'Patia' });
  place = await insertPlace({ areaId: area.id, name: 'Tarini' });
  const dish = await insertStandardDish({ name: 'Chicken Dum Biryani', diet: 'non_veg' });
  menuItem = await insertMenuItem({ placeId: place.id, standardDishId: dish.id, name: 'Special Chicken Biryani' });
});
afterAll(closeConnections);

const rate = (overrides = {}) =>
  pool.query(
    `INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, is_current)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      overrides.userId ?? user.id,
      overrides.menuItemId ?? menuItem.id,
      overrides.stars ?? 4,
      'wouldOrderAgain' in overrides ? overrides.wouldOrderAgain : true, // null must stay null
      overrides.isCurrent ?? true,
    ],
  );

describe('dish_ratings', () => {
  test('stars = 6 is rejected', async () => {
    await expectPgError(rate({ stars: 6 }), CHECK_VIOLATION);
  });

  test('stars = 0 is rejected', async () => {
    await expectPgError(rate({ stars: 0 }), CHECK_VIOLATION);
  });

  test('would_order_again is required', async () => {
    await expectPgError(rate({ wouldOrderAgain: null }), NOT_NULL_VIOLATION);
  });

  test('two current ratings for the same user + menu item are rejected', async () => {
    await rate();
    await expectPgError(rate(), UNIQUE_VIOLATION);
  });

  test('an old (not current) rating plus a current one is allowed', async () => {
    await rate({ isCurrent: false });
    await expect(rate()).resolves.toBeDefined();
  });

  test('anonymised ratings (user_id NULL) never clash', async () => {
    await pool.query(`INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again) VALUES (NULL, $1, 4, true)`, [menuItem.id]);
    await expect(
      pool.query(`INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again) VALUES (NULL, $1, 5, true)`, [menuItem.id]),
    ).resolves.toBeDefined();
  });

  test('bad spice value and review_text > 1000 chars are rejected', async () => {
    await expectPgError(
      pool.query(`INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, spice) VALUES ($1, $2, 4, true, 'extreme')`, [user.id, menuItem.id]),
      CHECK_VIOLATION,
    );
    await expectPgError(
      pool.query(`INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, review_text) VALUES ($1, $2, 4, true, $3)`, [user.id, menuItem.id, 'x'.repeat(1001)]),
      CHECK_VIOLATION,
    );
  });
});

describe('place_reviews', () => {
  test('one current review per user per place', async () => {
    const review = `INSERT INTO place_reviews (user_id, place_id, stars) VALUES ($1, $2, 4)`;
    await pool.query(review, [user.id, place.id]);
    await expectPgError(pool.query(review, [user.id, place.id]), UNIQUE_VIOLATION);
  });

  test('noise must be quiet / moderate / loud', async () => {
    await expectPgError(
      pool.query(`INSERT INTO place_reviews (user_id, place_id, stars, noise) VALUES ($1, $2, 4, 'silent')`, [user.id, place.id]),
      CHECK_VIOLATION,
    );
  });
});

describe('photos — exactly one parent', () => {
  const insertPhoto = (ratingId, reviewId, placeId) =>
    pool.query(
      `INSERT INTO photos (url, cloudinary_public_id, dish_rating_id, place_review_id, place_id) VALUES ('u', 'p', $1, $2, $3)`,
      [ratingId, reviewId, placeId],
    );

  test('photo with 0 parents is rejected', async () => {
    await expectPgError(insertPhoto(null, null, null), CHECK_VIOLATION);
  });

  test('photo with 2 parents is rejected', async () => {
    const { rows } = await rate();
    await expectPgError(insertPhoto(rows[0].id, null, place.id), CHECK_VIOLATION);
  });

  test('photo with exactly 1 parent is accepted', async () => {
    await expect(insertPhoto(null, null, place.id)).resolves.toBeDefined();
  });
});

describe('places', () => {
  test('duplicate (source, source_ref) is rejected', async () => {
    await insertPlace({ areaId: area.id, name: 'A', source: 'osm', sourceRef: 'node/123' });
    await expectPgError(insertPlace({ areaId: area.id, name: 'B', source: 'osm', sourceRef: 'node/123' }), UNIQUE_VIOLATION);
  });

  test('same source_ref from different sources is allowed', async () => {
    await insertPlace({ areaId: area.id, name: 'A', source: 'osm', sourceRef: 'x1' });
    await expect(insertPlace({ areaId: area.id, name: 'A', source: 'foursquare', sourceRef: 'x1' })).resolves.toBeDefined();
  });

  test('user-added places (no source_ref) never clash', async () => {
    await insertPlace({ areaId: area.id, name: 'Stall 1' });
    await expect(insertPlace({ areaId: area.id, name: 'Stall 2' })).resolves.toBeDefined();
  });

  test('name longer than 150 chars and unknown place_type are rejected', async () => {
    await expectPgError(insertPlace({ areaId: area.id, name: 'x'.repeat(151) }), CHECK_VIOLATION);
    await expectPgError(insertPlace({ areaId: area.id, placeType: 'nightclub' }), CHECK_VIOLATION);
  });

  test('status defaults to unverified', async () => {
    expect(place.status).toBe('unverified');
  });
});

describe('place_reports', () => {
  test('reason = duplicate without duplicate_of is rejected', async () => {
    await expectPgError(
      pool.query(`INSERT INTO place_reports (place_id, reported_by, reason) VALUES ($1, $2, 'duplicate')`, [place.id, user.id]),
      CHECK_VIOLATION,
    );
  });

  test('reason = duplicate with duplicate_of is accepted; status defaults to pending', async () => {
    const other = await insertPlace({ areaId: area.id, name: 'Tarini 2' });
    const { rows } = await pool.query(
      `INSERT INTO place_reports (place_id, reported_by, reason, duplicate_of) VALUES ($1, $2, 'duplicate', $3) RETURNING status`,
      [place.id, user.id, other.id],
    );
    expect(rows[0].status).toBe('pending');
  });
});

describe('opening_hours', () => {
  test('day must be 0–6 and opens_at ≠ closes_at', async () => {
    const q = `INSERT INTO opening_hours (place_id, day, opens_at, closes_at) VALUES ($1, $2, $3, $4)`;
    await expectPgError(pool.query(q, [place.id, 7, '09:00', '17:00']), CHECK_VIOLATION);
    await expectPgError(pool.query(q, [place.id, 1, '09:00', '09:00']), CHECK_VIOLATION);
  });

  test('after-midnight hours and two shifts on one day are allowed', async () => {
    const q = `INSERT INTO opening_hours (place_id, day, opens_at, closes_at) VALUES ($1, $2, $3, $4)`;
    await pool.query(q, [place.id, 5, '18:00', '02:00']);
    await pool.query(q, [place.id, 1, '08:00', '11:00']);
    await expect(pool.query(q, [place.id, 1, '17:00', '22:00'])).resolves.toBeDefined();
  });
});

describe('place_confirmations / place_tag_votes', () => {
  test('one confirmation per user per place', async () => {
    const q = `INSERT INTO place_confirmations (place_id, confirmed_by, weight) VALUES ($1, $2, 1.0)`;
    await pool.query(q, [place.id, user.id]);
    await expectPgError(pool.query(q, [place.id, user.id]), UNIQUE_VIOLATION);
  });

  test('one vote per user per tag per place', async () => {
    const { rows } = await pool.query(`SELECT id FROM tags WHERE name = 'Work' AND type = 'mood'`);
    const q = `INSERT INTO place_tag_votes (place_id, tag_id, user_id, source) VALUES ($1, $2, $3, 'user')`;
    await pool.query(q, [place.id, rows[0].id, user.id]);
    await expectPgError(pool.query(q, [place.id, rows[0].id, user.id]), UNIQUE_VIOLATION);
  });
});

describe('food', () => {
  test('dish alias must be lowercase and maps to exactly one dish', async () => {
    const dish = await insertStandardDish({ name: 'Mutton Biryani', diet: 'non_veg' });
    const q = `INSERT INTO dish_aliases (alias, standard_dish_id) VALUES ($1, $2)`;
    await expectPgError(pool.query(q, ['Mutton Biriyani', dish.id]), CHECK_VIOLATION);
    await pool.query(q, ['mutton biriyani', dish.id]);
    await expectPgError(pool.query(q, ['mutton biriyani', menuItem.standard_dish_id]), UNIQUE_VIOLATION);
  });

  test('menu item price must be > 0', async () => {
    await expectPgError(
      pool.query(`UPDATE menu_items SET price = 0 WHERE id = $1`, [menuItem.id]),
      CHECK_VIOLATION,
    );
  });

  test('lookup rows in use cannot be deleted (RESTRICT)', async () => {
    const cuisineId = await ensureLookup('cuisines', 'Test Cuisine');
    await expectPgError(pool.query(`DELETE FROM cuisines WHERE id = $1`, [cuisineId]), FK_VIOLATION);
  });
});

describe('personal', () => {
  test('wishlist: exactly one target, no duplicate saves', async () => {
    const q = `INSERT INTO wishlist_items (user_id, place_id, menu_item_id) VALUES ($1, $2, $3)`;
    await expectPgError(pool.query(q, [user.id, null, null]), CHECK_VIOLATION);
    await expectPgError(pool.query(q, [user.id, place.id, menuItem.id]), CHECK_VIOLATION);
    await pool.query(q, [user.id, place.id, null]);
    await expectPgError(pool.query(q, [user.id, place.id, null]), UNIQUE_VIOLATION);
  });

  test('private note: exactly one target and text ≤ 2000 chars', async () => {
    const q = `INSERT INTO private_notes (user_id, place_id, menu_item_id, text) VALUES ($1, $2, $3, $4)`;
    await expectPgError(pool.query(q, [user.id, place.id, menuItem.id, 'hi']), CHECK_VIOLATION);
    await expectPgError(pool.query(q, [user.id, place.id, null, 'x'.repeat(2001)]), CHECK_VIOLATION);
    await expect(pool.query(q, [user.id, place.id, null, 'Ask for less oil'])).resolves.toBeDefined();
  });
});

describe('users / auth', () => {
  test('defaults: role user, trust 1.0, journal private', async () => {
    expect(user.role).toBe('user');
    expect(user.trust_score).toBe(1);
    expect(user.journal_visibility).toBe('private');
  });

  test('duplicate email or google_id is rejected', async () => {
    await expectPgError(insertUser({ email: user.email }), UNIQUE_VIOLATION);
    await expectPgError(insertUser({ googleId: user.google_id }), UNIQUE_VIOLATION);
  });

  test('taste profile scales are checked', async () => {
    await expectPgError(
      pool.query(`INSERT INTO taste_profiles (user_id, spice_quiz) VALUES ($1, 5)`, [user.id]),
      CHECK_VIOLATION,
    );
  });
});
