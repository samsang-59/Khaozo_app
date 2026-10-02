// wishlistRepo — wishlist_items (a place, a menu item or a standard dish).
import { pool } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

export const list = async (userId) => {
  const { rows } = await pool.query(
    `SELECT w.id, w.tried_at, w.created_at,
            w.place_id, p.name AS place_name,
            w.menu_item_id, m.name AS menu_item_name, mp.id AS menu_item_place_id, mp.name AS menu_item_place_name,
            w.standard_dish_id, d.name AS standard_dish_name
     FROM wishlist_items w
     LEFT JOIN places p ON p.id = w.place_id
     LEFT JOIN menu_items m ON m.id = w.menu_item_id
     LEFT JOIN places mp ON mp.id = m.place_id
     LEFT JOIN standard_dishes d ON d.id = w.standard_dish_id
     WHERE w.user_id = $1
     ORDER BY (w.tried_at IS NOT NULL), w.created_at DESC`,
    [userId],
  );
  return rowsToCamel(rows);
};

// Returns null if the same thing is already saved.
export const add = async (userId, { placeId = null, menuItemId = null, standardDishId = null }) => {
  const { rows } = await pool.query(
    `INSERT INTO wishlist_items (user_id, place_id, menu_item_id, standard_dish_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, place_id, menu_item_id, standard_dish_id) DO NOTHING
     RETURNING *`,
    [userId, placeId, menuItemId, standardDishId],
  );
  return toCamel(rows[0]) ?? null;
};

export const removeOwned = async (id, userId) => {
  const { rowCount } = await pool.query('DELETE FROM wishlist_items WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
};

// Rating a dish marks matching wishlist items "Tried ✅" (the menu item itself or its standard dish).
export const markTried = async (userId, { menuItemId, standardDishId }) => {
  const { rowCount } = await pool.query(
    `UPDATE wishlist_items SET tried_at = now()
     WHERE user_id = $1 AND tried_at IS NULL AND (menu_item_id = $2 OR standard_dish_id = $3)`,
    [userId, menuItemId, standardDishId],
  );
  return rowCount;
};
