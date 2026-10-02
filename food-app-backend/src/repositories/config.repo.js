// configRepo — config_settings (business rules; secrets never live here).
import { pool } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

// { key: value } for every setting
export const getAll = async () => {
  const { rows } = await pool.query('SELECT key, value FROM config_settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
};

// Admin config editor: every setting + who changed it last
export const listForAdmin = async () => {
  const { rows } = await pool.query(
    `SELECT c.key, c.value, c.description, c.updated_at, c.updated_by, u.name AS updated_by_name
     FROM config_settings c LEFT JOIN users u ON u.id = c.updated_by
     ORDER BY c.key`,
  );
  return rowsToCamel(rows);
};

export const findValue = async (key) => {
  const { rows } = await pool.query('SELECT value FROM config_settings WHERE key = $1', [key]);
  return rows[0] ?? null;
};

export const update = async (key, value, updatedBy) => {
  const { rows } = await pool.query(
    `UPDATE config_settings SET value = $2::jsonb, updated_by = $3, updated_at = now() WHERE key = $1
     RETURNING key, value, description, updated_at, updated_by`,
    [key, JSON.stringify(value), updatedBy],
  );
  return toCamel(rows[0]) ?? null;
};
