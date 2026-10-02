// statsRepo — menu_item_stats · place_stats (materialized views: read + refresh).
import { pool } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

// CONCURRENTLY: readers keep seeing the old numbers while the new ones are computed.
export const refresh = async () => {
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY menu_item_stats');
  await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY place_stats');
};

const ITEM_COLUMNS = `rating_count, avg_stars, order_again_pct, bayes_score, label, typical_spice, typical_sweetness, typical_oiliness`;

export const forMenuItem = async (menuItemId) => {
  const { rows } = await pool.query(`SELECT ${ITEM_COLUMNS} FROM menu_item_stats WHERE menu_item_id = $1`, [menuItemId]);
  return toCamel(rows[0]) ?? null;
};

// { menuItemId: stats } for a menu
export const forPlaceMenu = async (placeId) => {
  const { rows } = await pool.query(`SELECT menu_item_id, ${ITEM_COLUMNS} FROM menu_item_stats WHERE place_id = $1`, [placeId]);
  return Object.fromEntries(rowsToCamel(rows).map(({ menuItemId, ...s }) => [menuItemId, s]));
};

export const forPlace = async (placeId) => {
  const { rows } = await pool.query(
    `SELECT s.*, COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'type', t.type) ORDER BY array_position(s.tag_ids, t.id))
                           FROM tags t WHERE t.id = ANY(s.tag_ids)), '[]') AS tags
     FROM place_stats s WHERE s.place_id = $1`,
    [placeId],
  );
  const row = toCamel(rows[0]);
  if (!row) return null;
  delete row.placeId;
  delete row.tagIds;
  return row;
};

// Place page: top must-order dishes + up to N mixed-review dishes
export const labelledForPlace = async (placeId, { mustOrder, mixed }) => {
  const { rows } = await pool.query(
    `(SELECT s.menu_item_id, m.name, s.label, s.avg_stars, s.rating_count, s.order_again_pct, s.bayes_score, m.ai_summary
      FROM menu_item_stats s JOIN menu_items m ON m.id = s.menu_item_id
      WHERE s.place_id = $1 AND s.label = 'must_order' ORDER BY s.bayes_score DESC LIMIT $2)
     UNION ALL
     (SELECT s.menu_item_id, m.name, s.label, s.avg_stars, s.rating_count, s.order_again_pct, s.bayes_score, m.ai_summary
      FROM menu_item_stats s JOIN menu_items m ON m.id = s.menu_item_id
      WHERE s.place_id = $1 AND s.label = 'mixed_reviews' ORDER BY s.bayes_score ASC LIMIT $3)`,
    [placeId, mustOrder, mixed],
  );
  return rowsToCamel(rows);
};

// Best places for a standard dish: by Bayesian score (only places still open for business).
// With a centre, distance is added for display. Keyset on (bayes_score DESC, menu_item_id).
export const bestForDish = async (standardDishId, { lat, lng, limit, cursor }) => {
  const params = [standardDishId, limit + 1];
  const hasCentre = lat != null && lng != null;
  let distance = 'NULL::float';
  if (hasCentre) {
    params.push(lng, lat);
    distance = `ST_Distance(p.location, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)`;
  }
  let after = '';
  if (cursor) {
    params.push(cursor.s, cursor.id);
    after = `AND (s.bayes_score, -s.menu_item_id) < ($${params.length - 1}::float, -$${params.length}::bigint)`;
  }
  const { rows } = await pool.query(
    `SELECT s.menu_item_id, m.name AS menu_item_name, m.price, s.rating_count, s.avg_stars, s.bayes_score,
            s.order_again_pct, s.label, s.typical_spice,
            p.id AS place_id, p.name AS place_name, p.status AS place_status, a.name AS area_name,
            ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng, ${distance} AS distance_m
     FROM menu_item_stats s
     JOIN menu_items m ON m.id = s.menu_item_id
     JOIN places p ON p.id = s.place_id
     JOIN areas a ON a.id = p.area_id
     WHERE s.standard_dish_id = $1 AND s.rating_count > 0
       AND p.deleted_at IS NULL AND p.status <> 'closed' ${after}
     ORDER BY s.bayes_score DESC, s.menu_item_id ASC
     LIMIT $2`,
    params,
  );
  return rowsToCamel(rows);
};
