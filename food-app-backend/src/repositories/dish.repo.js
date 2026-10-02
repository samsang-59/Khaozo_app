// dishRepo — standard_dishes · dish_aliases.
import { pool } from '../config/db.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

const DISH_COLUMNS = `
  d.id, d.name, d.diet, d.status, d.category_id, c.name AS category, d.cuisine_id, cu.name AS cuisine,
  d.main_ingredient_id, mi.name AS main_ingredient`;
const DISH_JOINS = `
  JOIN dish_categories c ON c.id = d.category_id
  JOIN cuisines cu ON cu.id = d.cuisine_id
  LEFT JOIN main_ingredients mi ON mi.id = d.main_ingredient_id`;

export const findById = async (id) => {
  const { rows } = await pool.query(`SELECT ${DISH_COLUMNS} FROM standard_dishes d ${DISH_JOINS} WHERE d.id = $1`, [id]);
  return toCamel(rows[0]) ?? null;
};

// Exact match on a dish name (case-insensitive) or a stored alias (aliases are lowercase).
export const findExact = async (text) => {
  const { rows } = await pool.query(
    `SELECT ${DISH_COLUMNS} FROM standard_dishes d ${DISH_JOINS}
     WHERE lower(d.name) = $1
        OR d.id = (SELECT standard_dish_id FROM dish_aliases WHERE alias = $1)
     LIMIT 1`,
    [text.toLowerCase()],
  );
  return toCamel(rows[0]) ?? null;
};

// Fuzzy (pg_trgm) over names and aliases; best score per dish.
export const findSimilar = async (text, limit = 5) => {
  const { rows } = await pool.query(
    `WITH hits AS (
       SELECT id AS dish_id, similarity(lower(name), $1) AS score FROM standard_dishes WHERE lower(name) % $1
       UNION ALL
       SELECT standard_dish_id, similarity(alias, $1) FROM dish_aliases WHERE alias % $1
     ), best AS (
       SELECT dish_id, MAX(score) AS score FROM hits GROUP BY dish_id
     )
     SELECT ${DISH_COLUMNS}, round(b.score::numeric, 2)::float AS score
     FROM best b JOIN standard_dishes d ON d.id = b.dish_id ${DISH_JOINS}
     ORDER BY b.score DESC, d.name
     LIMIT $2`,
    [text.toLowerCase(), limit],
  );
  return rowsToCamel(rows);
};

// A dish typed by a user that matches nothing → new standard dish, flagged for admin review.
export const createPending = async ({ name, categoryId, cuisineId, mainIngredientId, diet, createdBy }) => {
  const { rows } = await pool.query(
    `INSERT INTO standard_dishes (name, category_id, cuisine_id, main_ingredient_id, diet, status, created_by)
     VALUES ($1, $2, $3, $4, $5, 'pending_review', $6)
     ON CONFLICT (name) DO NOTHING
     RETURNING id`,
    [name, categoryId, cuisineId, mainIngredientId, diet, createdBy],
  );
  return rows[0]?.id ?? null;
};

// A user-confirmed spelling becomes a new alias (ignored if the alias already exists).
export const addAlias = async (alias, standardDishId) => {
  await pool.query(
    'INSERT INTO dish_aliases (alias, standard_dish_id) VALUES ($1, $2) ON CONFLICT (alias) DO NOTHING',
    [alias.toLowerCase(), standardDishId],
  );
};

// Journal → My Contributions
export const findCreatedByUser = async (userId) => {
  const { rows } = await pool.query(
    'SELECT id, name, status, created_at FROM standard_dishes WHERE created_by = $1 ORDER BY created_at DESC',
    [userId],
  );
  return rowsToCamel(rows);
};


// "biryani" → every active dish in the Biryani category (search: category words)
export const findIdsByCategoryText = async (text) => {
  const { rows } = await pool.query(
    `SELECT d.id FROM standard_dishes d JOIN dish_categories c ON c.id = d.category_id
     WHERE d.status = 'active' AND (lower(c.name) = $1 OR similarity(lower(c.name), $1) >= 0.6)`,
    [text.toLowerCase()],
  );
  return rows.map((r) => r.id);
};

// Embedding step of dishMatcher: closest dishes by cosine similarity (pgvector <=>)
export const findNearestByEmbedding = async (vector, { limit = 5, minSimilarity }) => {
  const { rows } = await pool.query(
    `SELECT ${DISH_COLUMNS}, round((1 - (d.embedding <=> $1::vector))::numeric, 2)::float AS score
     FROM standard_dishes d ${DISH_JOINS}
     WHERE d.embedding IS NOT NULL AND 1 - (d.embedding <=> $1::vector) >= $3
     ORDER BY d.embedding <=> $1::vector
     LIMIT $2`,
    [JSON.stringify(vector), limit, minSimilarity],
  );
  return rowsToCamel(rows);
};

export const findMissingEmbeddings = async (limit = 100) => {
  const { rows } = await pool.query('SELECT id, name FROM standard_dishes WHERE embedding IS NULL ORDER BY id LIMIT $1', [limit]);
  return rows;
};

export const setEmbedding = async (id, vector) => {
  await pool.query('UPDATE standard_dishes SET embedding = $2::vector WHERE id = $1', [id, JSON.stringify(vector)]);
};
