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
