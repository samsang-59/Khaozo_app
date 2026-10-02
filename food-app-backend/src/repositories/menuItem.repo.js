// menuItemRepo — menu_items.
import { pool } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

// Active menu of a place (stats / labels join in once the materialized views exist — Phase 5).
export const listByPlace = async (placeId) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.name, m.price, m.standard_dish_id, d.name AS standard_dish, d.diet,
            c.name AS category, m.ai_summary
     FROM menu_items m
     JOIN standard_dishes d ON d.id = m.standard_dish_id
     JOIN dish_categories c ON c.id = d.category_id
     WHERE m.place_id = $1 AND m.status = 'active'
     ORDER BY c.name, m.name`,
    [placeId],
  );
  return rowsToCamel(rows);
};

export const findSameName = async (placeId, name) => {
  const { rows } = await pool.query(
    `SELECT id FROM menu_items WHERE place_id = $1 AND lower(name) = lower($2) AND status = 'active' LIMIT 1`,
    [placeId, name],
  );
  return rows[0]?.id ?? null;
};

export const create = async ({ placeId, standardDishId, name, price, addedBy }) => {
  const { rows } = await pool.query(
    `INSERT INTO menu_items (place_id, standard_dish_id, name, price, added_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, place_id, standard_dish_id, name, price, status, created_at`,
    [placeId, standardDishId, name, price, addedBy],
  );
  return toCamel(rows[0]);
};

// Menu item + its place and standard dish (dish page, rating checks)
export const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.name, m.price, m.status, m.ai_summary, m.summary_updated_at, m.created_at,
            m.place_id, p.name AS place_name, p.status AS place_status, p.deleted_at AS place_deleted_at,
            m.standard_dish_id, d.name AS standard_dish_name, d.diet, d.status AS standard_dish_status,
            c.name AS category, cu.name AS cuisine
     FROM menu_items m
     JOIN places p ON p.id = m.place_id
     JOIN standard_dishes d ON d.id = m.standard_dish_id
     JOIN dish_categories c ON c.id = d.category_id
     JOIN cuisines cu ON cu.id = d.cuisine_id
     WHERE m.id = $1`,
    [id],
  );
  return toCamel(rows[0]) ?? null;
};

// AI summary job input: label (from stats), names, and text reviews (newest first).
export const summaryInputs = async (menuItemId, maxReviews = 30) => {
  const { rows } = await pool.query(
    `SELECT m.id, m.name, m.summary_updated_at, p.name AS place_name, s.label,
            (SELECT COUNT(*) FROM dish_ratings r
              WHERE r.menu_item_id = m.id AND r.is_current AND r.deleted_at IS NULL AND r.review_text IS NOT NULL
                AND (m.summary_updated_at IS NULL OR r.created_at > m.summary_updated_at))::int AS new_text_reviews,
            COALESCE((SELECT array_agg(t.review_text) FROM (
               SELECT review_text FROM dish_ratings r
               WHERE r.menu_item_id = m.id AND r.is_current AND r.deleted_at IS NULL AND r.review_text IS NOT NULL
               ORDER BY r.created_at DESC LIMIT $2) t), '{}') AS reviews
     FROM menu_items m
     JOIN places p ON p.id = m.place_id
     LEFT JOIN menu_item_stats s ON s.menu_item_id = m.id
     WHERE m.id = $1`,
    [menuItemId, maxReviews],
  );
  return toCamel(rows[0]) ?? null;
};

export const setSummary = async (menuItemId, summary) => {
  await pool.query('UPDATE menu_items SET ai_summary = $2, summary_updated_at = now(), updated_at = now() WHERE id = $1', [menuItemId, summary]);
};
