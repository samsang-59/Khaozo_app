// metaRepo — areas, cuisines, dish_categories, main_ingredients, tags.
import { pool } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

const LOOKUP_TABLES = new Set(['cuisines', 'dish_categories', 'main_ingredients', 'tags', 'areas']);

// How many of the given ids exist in a lookup table (used to validate user input).
export const countExisting = async (table, ids) => {
  if (!LOOKUP_TABLES.has(table)) throw new Error(`Not a lookup table: ${table}`);
  if (ids.length === 0) return 0;
  const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE id = ANY($1::bigint[])`, [ids]);
  return rows[0].n;
};

export const listAreas = async () => {
  const { rows } = await pool.query(
    'SELECT id, name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM areas ORDER BY name',
  );
  return rowsToCamel(rows);
};

export const findArea = async (id) => {
  const { rows } = await pool.query(
    'SELECT id, name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng FROM areas WHERE id = $1',
    [id],
  );
  return toCamel(rows[0]) ?? null;
};

export const listNamed = async (table) => {
  if (!['cuisines', 'dish_categories', 'main_ingredients'].includes(table)) throw new Error(`Not a named lookup: ${table}`);
  const { rows } = await pool.query(`SELECT id, name FROM ${table} ORDER BY name`);
  return rows;
};

export const listTags = async () => {
  const { rows } = await pool.query('SELECT id, name, type FROM tags ORDER BY type, id');
  return rows;
};

export const findMainIngredient = async (id) => {
  const { rows } = await pool.query('SELECT id, name FROM main_ingredients WHERE id = $1', [id]);
  return rows[0] ?? null;
};

// Search: "near patia" → the Patia pin (exact name, else closest spelling)
export const findAreaByText = async (text) => {
  const { rows } = await pool.query(
    `SELECT id, name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
     FROM areas
     WHERE lower(name) = $1 OR similarity(lower(name), $1) >= 0.4
     ORDER BY (lower(name) = $1) DESC, similarity(lower(name), $1) DESC
     LIMIT 1`,
    [text.toLowerCase()],
  );
  return rows[0] ? toCamel(rows[0]) : null;
};
