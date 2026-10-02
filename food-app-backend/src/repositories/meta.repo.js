// metaRepo — areas, cuisines, dish_categories, main_ingredients, tags.
import { pool } from '../config/db.js';

const LOOKUP_TABLES = new Set(['cuisines', 'dish_categories', 'main_ingredients', 'tags', 'areas']);

// How many of the given ids exist in a lookup table (used to validate user input).
export const countExisting = async (table, ids) => {
  if (!LOOKUP_TABLES.has(table)) throw new Error(`Not a lookup table: ${table}`);
  if (ids.length === 0) return 0;
  const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE id = ANY($1::bigint[])`, [ids]);
  return rows[0].n;
};
