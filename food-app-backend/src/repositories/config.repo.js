// configRepo — config_settings (business rules; secrets never live here).
import { pool } from '../config/db.js';

// { key: value } for every setting
export const getAll = async () => {
  const { rows } = await pool.query('SELECT key, value FROM config_settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
};
