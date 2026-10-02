// ratingRepo — dish_ratings (+ the journal's read queries over ratings and reviews).
import { pool, withTransaction } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

export const RATING_FIELDS = ['stars', 'wouldOrderAgain', 'taste', 'portion', 'value', 'spice', 'sweetness', 'oiliness', 'reviewText', 'pricePaid'];
const COLUMN = {
  stars: 'stars', wouldOrderAgain: 'would_order_again', taste: 'taste', portion: 'portion', value: 'value',
  spice: 'spice', sweetness: 'sweetness', oiliness: 'oiliness', reviewText: 'review_text', pricePaid: 'price_paid',
};

export const findById = async (id) => {
  const { rows } = await pool.query('SELECT * FROM dish_ratings WHERE id = $1 AND deleted_at IS NULL', [id]);
  return toCamel(rows[0]) ?? null;
};

export const findCurrent = async (userId, menuItemId) => {
  const { rows } = await pool.query(
    'SELECT * FROM dish_ratings WHERE user_id = $1 AND menu_item_id = $2 AND is_current AND deleted_at IS NULL',
    [userId, menuItemId],
  );
  return toCamel(rows[0]) ?? null;
};

// New current rating; the previous current one (if any) becomes history — one transaction.
export const replaceCurrent = async (userId, menuItemId, fields) =>
  withTransaction(async (client) => {
    await client.query(
      'UPDATE dish_ratings SET is_current = false, updated_at = now() WHERE user_id = $1 AND menu_item_id = $2 AND is_current',
      [userId, menuItemId],
    );
    const cols = RATING_FIELDS.filter((f) => fields[f] !== undefined);
    const { rows } = await client.query(
      `INSERT INTO dish_ratings (user_id, menu_item_id, ${cols.map((f) => COLUMN[f]).join(', ')})
       VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')})
       RETURNING *`,
      [userId, menuItemId, ...cols.map((f) => fields[f])],
    );
    return toCamel(rows[0]);
  });

export const update = async (id, fields) => {
  const cols = RATING_FIELDS.filter((f) => fields[f] !== undefined);
  const { rows } = await pool.query(
    `UPDATE dish_ratings SET ${cols.map((f, i) => `${COLUMN[f]} = $${i + 2}`).join(', ')}, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, ...cols.map((f) => fields[f])],
  );
  return toCamel(rows[0]) ?? null;
};

// Hard delete by the owner (photos cascade; Cloudinary files are removed by the service first).
export const remove = async (id) => {
  await pool.query('DELETE FROM dish_ratings WHERE id = $1', [id]);
};

// Public list for a menu item: current, not removed. Keyset on (created_at, id) newest first.
export const listForMenuItem = async (menuItemId, { limit, cursor }) => {
  const params = [menuItemId, limit + 1];
  let after = '';
  if (cursor) {
    params.push(cursor.t, cursor.id);
    after = 'AND (r.created_at, r.id) < ($3::timestamptz, $4::bigint)';
  }
  const { rows } = await pool.query(
    `SELECT r.id, r.stars, r.would_order_again, r.taste, r.portion, r.value, r.spice, r.sweetness, r.oiliness,
            r.review_text, r.price_paid, r.created_at,
            u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar,
            COALESCE((SELECT json_agg(json_build_object('id', ph.id, 'url', ph.url) ORDER BY ph.id) FROM photos ph WHERE ph.dish_rating_id = r.id), '[]') AS photos
     FROM dish_ratings r LEFT JOIN users u ON u.id = r.user_id
     WHERE r.menu_item_id = $1 AND r.is_current AND r.deleted_at IS NULL ${after}
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT $2`,
    params,
  );
  return rowsToCamel(rows);
};

// ---- Journal ----------------------------------------------------------------
// One row per entry (dish rating or place review) with its card number:
// same place + gap ≤ gapHours from the previous entry at that place → same card.
const JOURNAL_ENTRIES = `
  WITH entries AS (
    SELECT 'rating' AS kind, r.id, m.place_id, r.created_at, r.stars,
           m.id AS menu_item_id, m.name AS menu_item_name, NULL::bigint AS review_id, r.review_text,
           r.would_order_again
    FROM dish_ratings r JOIN menu_items m ON m.id = r.menu_item_id
    WHERE r.user_id = $1 AND r.deleted_at IS NULL
    UNION ALL
    SELECT 'review', v.id, v.place_id, v.created_at, v.stars, NULL, NULL, v.id, v.review_text, NULL
    FROM place_reviews v
    WHERE v.user_id = $1 AND v.deleted_at IS NULL
  ), marked AS (
    SELECT e.*,
           CASE WHEN LAG(e.created_at) OVER w IS NULL
                  OR e.created_at - LAG(e.created_at) OVER w > make_interval(hours => $2::int)
                THEN 1 ELSE 0 END AS new_card
    FROM entries e
    WINDOW w AS (PARTITION BY e.place_id ORDER BY e.created_at, e.id)
  ), carded AS (
    SELECT m.*, SUM(new_card) OVER (PARTITION BY m.place_id ORDER BY m.created_at, m.id) AS card_no
    FROM marked m
  )`;

// Cards newest first, keyset on (started_at, place_id, card_no).
export const journalCards = async (userId, { gapHours, limit, cursor }) => {
  const params = [userId, gapHours, limit + 1];
  let after = '';
  if (cursor) {
    params.push(cursor.t, cursor.p, cursor.c);
    after = 'WHERE (started_at, place_id, card_no) < ($4::timestamptz, $5::bigint, $6::bigint)';
  }
  const { rows } = await pool.query(
    `${JOURNAL_ENTRIES}
     , cards AS (
       SELECT c.place_id, c.card_no, MIN(c.created_at) AS started_at, MAX(c.created_at) AS ended_at,
              json_agg(json_build_object(
                'kind', c.kind, 'id', c.id, 'stars', c.stars, 'createdAt', c.created_at,
                'menuItemId', c.menu_item_id, 'menuItemName', c.menu_item_name,
                'reviewText', c.review_text, 'wouldOrderAgain', c.would_order_again,
                'photos', COALESCE((SELECT json_agg(ph.url ORDER BY ph.id) FROM photos ph
                                    WHERE (c.kind = 'rating' AND ph.dish_rating_id = c.id)
                                       OR (c.kind = 'review' AND ph.place_review_id = c.id)), '[]'::json)
              ) ORDER BY c.created_at, c.id) AS entries
       FROM carded c GROUP BY c.place_id, c.card_no
     )
     SELECT cards.*, p.name AS place_name, a.name AS area_name
     FROM cards JOIN places p ON p.id = cards.place_id JOIN areas a ON a.id = p.area_id
     ${after}
     ORDER BY started_at DESC, place_id DESC, card_no DESC
     LIMIT $3`,
    params,
  );
  return rowsToCamel(rows);
};

// My Stats. since = null → all time.
export const journalStats = async (userId, since) => {
  const { rows } = await pool.query(
    `WITH r AS (
       SELECT r.*, m.place_id, m.name AS menu_item_name, m.standard_dish_id
       FROM dish_ratings r JOIN menu_items m ON m.id = r.menu_item_id
       WHERE r.user_id = $1 AND r.deleted_at IS NULL AND ($2::timestamptz IS NULL OR r.created_at >= $2)
     ), v AS (
       SELECT * FROM place_reviews
       WHERE user_id = $1 AND deleted_at IS NULL AND ($2::timestamptz IS NULL OR created_at >= $2)
     )
     SELECT
       (SELECT COUNT(*) FROM (SELECT place_id FROM r UNION SELECT place_id FROM v) x) AS places_tried,
       (SELECT COUNT(DISTINCT menu_item_id) FROM r) AS dishes_tried,
       (SELECT COUNT(*) FROM r) AS ratings_count,
       (SELECT COUNT(*) FROM v) AS reviews_count,
       (SELECT json_build_object('id', cu.id, 'name', cu.name, 'count', COUNT(*))
          FROM r JOIN standard_dishes d ON d.id = r.standard_dish_id JOIN cuisines cu ON cu.id = d.cuisine_id
          GROUP BY cu.id, cu.name ORDER BY COUNT(*) DESC, cu.name LIMIT 1) AS top_cuisine,
       (SELECT json_build_object('menuItemId', r.menu_item_id, 'name', r.menu_item_name, 'placeId', r.place_id,
                                 'placeName', p.name, 'avgStars', round(AVG(r.stars)::numeric, 1)::float, 'count', COUNT(*))
          FROM r JOIN places p ON p.id = r.place_id
          GROUP BY r.menu_item_id, r.menu_item_name, r.place_id, p.name
          ORDER BY AVG(r.stars) DESC, COUNT(*) DESC, MAX(r.created_at) DESC LIMIT 1) AS favourite_dish,
       (SELECT COALESCE(json_agg(x ORDER BY x.dish), '[]') FROM (
          SELECT d.name AS dish, json_agg(json_build_object('placeId', p.id, 'placeName', p.name,
                         'stars', latest.stars) ORDER BY latest.stars DESC, p.name) AS places
          FROM (SELECT DISTINCT ON (r.place_id, r.standard_dish_id) r.place_id, r.standard_dish_id, r.stars
                FROM r ORDER BY r.place_id, r.standard_dish_id, r.created_at DESC) latest
          JOIN standard_dishes d ON d.id = latest.standard_dish_id JOIN places p ON p.id = latest.place_id
          GROUP BY d.name HAVING COUNT(*) >= 2) x) AS comparisons`,
    [userId, since],
  );
  return toCamel(rows[0]);
};

// ---- Background-job inputs ------------------------------------------------------

// Per user: how many of their current ratings agree with / are far from the rest of the crowd
// (crowd = other current ratings of the same menu item; only items with ≥ minOthers of them).
export const trustSignals = async ({ minOthers, agreeWithin, farOff }) => {
  const { rows } = await pool.query(
    `WITH cur AS (
       SELECT user_id, menu_item_id, stars FROM dish_ratings WHERE is_current AND deleted_at IS NULL
     ), item AS (
       SELECT menu_item_id, COUNT(*) AS n, SUM(stars) AS total FROM cur GROUP BY menu_item_id
     ), dev AS (
       SELECT c.user_id, abs(c.stars - (i.total - c.stars)::float / (i.n - 1)) AS d
       FROM cur c JOIN item i USING (menu_item_id)
       WHERE c.user_id IS NOT NULL AND i.n - 1 >= $1
     )
     SELECT user_id, COUNT(*) FILTER (WHERE d <= $2)::int AS agree, COUNT(*) FILTER (WHERE d >= $3)::int AS far
     FROM dev GROUP BY user_id`,
    [minOthers, agreeWithin, farOff],
  );
  return rowsToCamel(rows);
};

// What a user's liked dishes (stars ≥ likedMinStars) say about their taste.
// Scales match taste_profiles: spice 1–4 · sweetness 1–3 · oiliness 1–3 · budget 1–4
// (budget from price paid, else menu price: <₹150 / ₹150–300 / ₹300–600 / ₹600+).
export const tasteSignals = async (userId, likedMinStars) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS ratings_used,
            AVG(CASE r.spice WHEN 'mild' THEN 1 WHEN 'medium' THEN 2 WHEN 'spicy' THEN 3 WHEN 'very_spicy' THEN 4 END) AS spice,
            AVG(CASE r.sweetness WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 END) AS sweet,
            AVG(CASE r.oiliness WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 END) AS oiliness,
            AVG(CASE WHEN COALESCE(r.price_paid, m.price) IS NULL THEN NULL
                     WHEN COALESCE(r.price_paid, m.price) < 150 THEN 1
                     WHEN COALESCE(r.price_paid, m.price) < 300 THEN 2
                     WHEN COALESCE(r.price_paid, m.price) < 600 THEN 3
                     ELSE 4 END) AS budget
     FROM dish_ratings r JOIN menu_items m ON m.id = r.menu_item_id
     WHERE r.user_id = $1 AND r.deleted_at IS NULL AND r.stars >= $2`,
    [userId, likedMinStars],
  );
  return toCamel(rows[0]);
};

// For auto meal-time tags
export const findWithPlace = async (id) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.user_id, r.created_at, m.place_id
     FROM dish_ratings r JOIN menu_items m ON m.id = r.menu_item_id
     WHERE r.id = $1 AND r.deleted_at IS NULL`,
    [id],
  );
  return toCamel(rows[0]) ?? null;
};
