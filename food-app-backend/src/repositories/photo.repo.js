// photoRepo — photos (exactly one parent: dish rating, place review or place).
import { pool, withTransaction } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

const PARENT_COLUMN = { rating: 'dish_rating_id', review: 'place_review_id', place: 'place_id' };
const PARENT_TABLE = { rating: 'dish_ratings', review: 'place_reviews', place: 'places' };

// Inserts photos only if the parent stays within `max` photos (parent row locked → no race).
// Returns the inserted rows, or null if they would not fit.
export const addWithinLimit = async (parentKind, parentId, photos, max) =>
  withTransaction(async (client) => {
    const col = PARENT_COLUMN[parentKind];
    await client.query(`SELECT id FROM ${PARENT_TABLE[parentKind]} WHERE id = $1 FOR UPDATE`, [parentId]);
    const { rows: [{ n }] } = await client.query(`SELECT COUNT(*) AS n FROM photos WHERE ${col} = $1`, [parentId]);
    if (n + photos.length > max) return null;
    const inserted = [];
    for (const p of photos) {
      const { rows } = await client.query(
        `INSERT INTO photos (url, cloudinary_public_id, ${col}) VALUES ($1, $2, $3) RETURNING id, url, created_at`,
        [p.url, p.publicId, parentId],
      );
      inserted.push(toCamel(rows[0]));
    }
    return inserted;
  });

export const countFor = async (parentKind, parentId) => {
  const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM photos WHERE ${PARENT_COLUMN[parentKind]} = $1`, [parentId]);
  return rows[0].n;
};

// Photo + who owns its parent (rating / review author, or the place's adder)
export const findWithOwner = async (id) => {
  const { rows } = await pool.query(
    `SELECT ph.id, ph.cloudinary_public_id, ph.dish_rating_id, ph.place_review_id, ph.place_id,
            COALESCE(r.user_id, v.user_id, p.added_by) AS owner_id
     FROM photos ph
     LEFT JOIN dish_ratings r ON r.id = ph.dish_rating_id
     LEFT JOIN place_reviews v ON v.id = ph.place_review_id
     LEFT JOIN places p ON p.id = ph.place_id
     WHERE ph.id = $1`,
    [id],
  );
  return toCamel(rows[0]) ?? null;
};

export const publicIdsFor = async (parentKind, parentId) => {
  const { rows } = await pool.query(
    `SELECT cloudinary_public_id FROM photos WHERE ${PARENT_COLUMN[parentKind]} = $1`,
    [parentId],
  );
  return rows.map((r) => r.cloudinary_public_id);
};

export const remove = async (id) => {
  await pool.query('DELETE FROM photos WHERE id = $1', [id]);
};

// Place gallery: photos of the place itself + its current reviews + current ratings of its menu items.
export const listForPlace = async (placeId, { limit, cursor }) => {
  const params = [placeId, limit + 1];
  let after = '';
  if (cursor) {
    params.push(cursor.id);
    after = 'AND ph.id < $3::bigint';
  }
  const { rows } = await pool.query(
    `SELECT ph.id, ph.url, ph.created_at,
            CASE WHEN ph.place_id IS NOT NULL THEN 'place' WHEN ph.place_review_id IS NOT NULL THEN 'review' ELSE 'rating' END AS source,
            m.id AS menu_item_id, m.name AS menu_item_name
     FROM photos ph
     LEFT JOIN place_reviews v ON v.id = ph.place_review_id
     LEFT JOIN dish_ratings r ON r.id = ph.dish_rating_id
     LEFT JOIN menu_items m ON m.id = r.menu_item_id
     WHERE (ph.place_id = $1
        OR (v.place_id = $1 AND v.is_current AND v.deleted_at IS NULL)
        OR (m.place_id = $1 AND r.is_current AND r.deleted_at IS NULL)) ${after}
     ORDER BY ph.id DESC
     LIMIT $2`,
    params,
  );
  return rowsToCamel(rows);
};

// Search cards: one cover photo per result, newest first.
//   menu item → its current ratings' photos · place → its gallery (same set as listForPlace)
// → { menuItems: { id: url }, places: { id: url } }
export const coverPhotos = async ({ menuItemIds = [], placeIds = [] }) => {
  const [items, places] = await Promise.all([
    menuItemIds.length
      ? pool.query(
        `SELECT DISTINCT ON (r.menu_item_id) r.menu_item_id AS id, ph.url
         FROM photos ph JOIN dish_ratings r ON r.id = ph.dish_rating_id
         WHERE r.menu_item_id = ANY($1::bigint[]) AND r.is_current AND r.deleted_at IS NULL
         ORDER BY r.menu_item_id, ph.id DESC`,
        [menuItemIds],
      )
      : { rows: [] },
    placeIds.length
      ? pool.query(
        `SELECT DISTINCT ON (pid) pid AS id, url FROM (
           SELECT ph.place_id AS pid, ph.id, ph.url FROM photos ph WHERE ph.place_id = ANY($1::bigint[])
           UNION ALL
           SELECT v.place_id, ph.id, ph.url FROM photos ph JOIN place_reviews v ON v.id = ph.place_review_id
           WHERE v.place_id = ANY($1::bigint[]) AND v.is_current AND v.deleted_at IS NULL
           UNION ALL
           SELECT m.place_id, ph.id, ph.url FROM photos ph JOIN dish_ratings r ON r.id = ph.dish_rating_id
           JOIN menu_items m ON m.id = r.menu_item_id
           WHERE m.place_id = ANY($1::bigint[]) AND r.is_current AND r.deleted_at IS NULL
         ) g
         ORDER BY pid, id DESC`,
        [placeIds],
      )
      : { rows: [] },
  ]);
  return {
    menuItems: Object.fromEntries(items.rows.map((r) => [r.id, r.url])),
    places: Object.fromEntries(places.rows.map((r) => [r.id, r.url])),
  };
};
