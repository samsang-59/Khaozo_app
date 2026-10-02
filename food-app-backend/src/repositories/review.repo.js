// reviewRepo — place_reviews (+ the user's tag votes, written in the same transaction).
import { pool, withTransaction } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

export const REVIEW_FIELDS = [
  'stars', 'vibe', 'looks', 'serviceSpeed', 'staff', 'hygiene', 'noise', 'wifi', 'plugPoints', 'ac', 'washroom',
  'bikeParking', 'carParking', 'acceptsCash', 'acceptsUpi', 'acceptsCard', 'crowd', 'reviewText',
];
const snake = (f) => f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export const findById = async (id) => {
  const { rows } = await pool.query('SELECT * FROM place_reviews WHERE id = $1 AND deleted_at IS NULL', [id]);
  return toCamel(rows[0]) ?? null;
};

export const findCurrent = async (userId, placeId) => {
  const { rows } = await pool.query(
    'SELECT * FROM place_reviews WHERE user_id = $1 AND place_id = $2 AND is_current AND deleted_at IS NULL',
    [userId, placeId],
  );
  return toCamel(rows[0]) ?? null;
};

// Replace the user's "user"-source tag votes for a place with tagIds (auto votes untouched).
const replaceUserTagVotes = async (client, userId, placeId, tagIds) => {
  await client.query(`DELETE FROM place_tag_votes WHERE user_id = $1 AND place_id = $2 AND source = 'user'`, [userId, placeId]);
  if (tagIds.length) {
    await client.query(
      `INSERT INTO place_tag_votes (place_id, tag_id, user_id, source)
       SELECT $2, unnest($3::bigint[]), $1, 'user'
       ON CONFLICT (place_id, tag_id, user_id) DO UPDATE SET source = 'user'`,
      [userId, placeId, tagIds],
    );
  }
};

// New current review (old current → history) + "Good for" tag votes — one transaction.
export const createWithTagVotes = async (userId, placeId, fields, tagIds) =>
  withTransaction(async (client) => {
    await client.query(
      'UPDATE place_reviews SET is_current = false, updated_at = now() WHERE user_id = $1 AND place_id = $2 AND is_current',
      [userId, placeId],
    );
    const cols = REVIEW_FIELDS.filter((f) => fields[f] !== undefined);
    const { rows } = await client.query(
      `INSERT INTO place_reviews (user_id, place_id${cols.map((f) => `, ${snake(f)}`).join('')})
       VALUES ($1, $2${cols.map((_, i) => `, $${i + 3}`).join('')})
       RETURNING *`,
      [userId, placeId, ...cols.map((f) => fields[f])],
    );
    if (tagIds !== undefined) await replaceUserTagVotes(client, userId, placeId, tagIds);
    return toCamel(rows[0]);
  });

export const updateWithTagVotes = async (review, fields, tagIds) =>
  withTransaction(async (client) => {
    const cols = REVIEW_FIELDS.filter((f) => fields[f] !== undefined);
    let row = review;
    if (cols.length) {
      const { rows } = await client.query(
        `UPDATE place_reviews SET ${cols.map((f, i) => `${snake(f)} = $${i + 2}`).join(', ')}, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [review.id, ...cols.map((f) => fields[f])],
      );
      row = toCamel(rows[0]);
    }
    if (tagIds !== undefined) await replaceUserTagVotes(client, review.userId, review.placeId, tagIds);
    return row;
  });

export const remove = async (id) => {
  await pool.query('DELETE FROM place_reviews WHERE id = $1', [id]);
};

export const listForPlace = async (placeId, { limit, cursor }) => {
  const params = [placeId, limit + 1];
  let after = '';
  if (cursor) {
    params.push(cursor.t, cursor.id);
    after = 'AND (v.created_at, v.id) < ($3::timestamptz, $4::bigint)';
  }
  const { rows } = await pool.query(
    `SELECT v.id, v.stars, v.vibe, v.looks, v.service_speed, v.staff, v.hygiene, v.noise, v.wifi, v.plug_points,
            v.ac, v.washroom, v.bike_parking, v.car_parking, v.accepts_cash, v.accepts_upi, v.accepts_card,
            v.crowd, v.review_text, v.created_at,
            u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar,
            COALESCE((SELECT json_agg(json_build_object('id', ph.id, 'url', ph.url) ORDER BY ph.id) FROM photos ph WHERE ph.place_review_id = v.id), '[]') AS photos
     FROM place_reviews v LEFT JOIN users u ON u.id = v.user_id
     WHERE v.place_id = $1 AND v.is_current AND v.deleted_at IS NULL ${after}
     ORDER BY v.created_at DESC, v.id DESC
     LIMIT $2`,
    params,
  );
  return rowsToCamel(rows);
};

export const userTagIds = async (userId, placeId) => {
  const { rows } = await pool.query(
    `SELECT tag_id FROM place_tag_votes WHERE user_id = $1 AND place_id = $2 AND source = 'user' ORDER BY tag_id`,
    [userId, placeId],
  );
  return rows.map((r) => r.tag_id);
};
