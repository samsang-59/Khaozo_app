// noteRepo — private_notes (only the owner can ever see them).
import { pool } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

export const list = async (userId) => {
  const { rows } = await pool.query(
    `SELECT n.id, n.text, n.created_at, n.updated_at,
            n.place_id, p.name AS place_name,
            n.menu_item_id, m.name AS menu_item_name, mp.name AS menu_item_place_name
     FROM private_notes n
     LEFT JOIN places p ON p.id = n.place_id
     LEFT JOIN menu_items m ON m.id = n.menu_item_id
     LEFT JOIN places mp ON mp.id = m.place_id
     WHERE n.user_id = $1
     ORDER BY n.updated_at DESC`,
    [userId],
  );
  return rowsToCamel(rows);
};

export const create = async (userId, { placeId = null, menuItemId = null, text }) => {
  const { rows } = await pool.query(
    'INSERT INTO private_notes (user_id, place_id, menu_item_id, text) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, placeId, menuItemId, text],
  );
  return toCamel(rows[0]);
};

export const updateOwned = async (id, userId, text) => {
  const { rows } = await pool.query(
    'UPDATE private_notes SET text = $3, updated_at = now() WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId, text],
  );
  return toCamel(rows[0]) ?? null;
};

export const removeOwned = async (id, userId) => {
  const { rowCount } = await pool.query('DELETE FROM private_notes WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
};
