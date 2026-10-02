// Test data helpers. Lookup tables with must-have rows from migration 002
// (cuisines, dish_categories, main_ingredients, tags, config_settings) are kept;
// everything else is emptied between test files.
import { pool } from '../../src/config/db.js';

const DATA_TABLES = [
  'group_session_members', 'group_sessions', 'wishlist_items', 'private_notes',
  'place_tag_votes', 'photos', 'place_reviews', 'dish_ratings',
  'menu_items', 'dish_aliases', 'standard_dishes',
  'place_reports', 'place_confirmations', 'opening_hours', 'place_cuisines', 'places',
  'login_sessions', 'taste_profile_avoid', 'taste_profile_cuisines', 'taste_profiles',
  'areas',
];

export const resetData = async () => {
  await pool.query(`TRUNCATE ${DATA_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  // users is referenced by config_settings.updated_by: TRUNCATE … CASCADE would wipe
  // the config rows too, so delete users (FK sets updated_by to NULL) instead.
  await pool.query('DELETE FROM users');
  await pool.query('ALTER TABLE users ALTER COLUMN id RESTART');
  // Materialized views keep old rows until refreshed — clear them too (ids restart above)
  await pool.query('REFRESH MATERIALIZED VIEW menu_item_stats');
  await pool.query('REFRESH MATERIALIZED VIEW place_stats');
};

// ---- Fixtures (minimal valid rows) --------------------------------------------

export const insertUser = async (overrides = {}) => {
  const n = Math.random().toString(36).slice(2, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, google_id, role)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [overrides.name ?? `User ${n}`, overrides.email ?? `${n}@example.com`, overrides.googleId ?? `g-${n}`, overrides.role ?? 'user'],
  );
  return rows[0];
};

export const insertArea = async ({ name = `Area ${Math.random().toString(36).slice(2, 8)}`, lat = 20.2961, lng = 85.8245 } = {}) => {
  const { rows } = await pool.query(
    `INSERT INTO areas (name, location) VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) RETURNING *`,
    [name, lng, lat],
  );
  return rows[0];
};

export const insertPlace = async ({ areaId, name = 'Test Place', lat = 20.2961, lng = 85.8245, placeType = 'restaurant', source = 'user', sourceRef = null } = {}) => {
  const { rows } = await pool.query(
    `INSERT INTO places (name, location, area_id, place_type, source, source_ref)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5, $6, $7) RETURNING *`,
    [name, lng, lat, areaId, placeType, source, sourceRef],
  );
  return rows[0];
};

export const lookupId = async (table, name) => {
  const { rows } = await pool.query(`SELECT id FROM ${table} WHERE name = $1`, [name]);
  if (!rows[0]) throw new Error(`${table} row "${name}" not found`);
  return rows[0].id;
};

// Get-or-create a lookup row (cuisines / dish_categories / main_ingredients) by name.
// Lookup tables aren't truncated, so this is safe to call from any test.
export const ensureLookup = async (table, name) => {
  const { rows } = await pool.query(
    `INSERT INTO ${table} (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [name],
  );
  return rows[0].id;
};

export const insertStandardDish = async ({ name = 'Test Dish', diet = 'veg', categoryId, cuisineId, mainIngredientId = null } = {}) => {
  const { rows } = await pool.query(
    `INSERT INTO standard_dishes (name, category_id, cuisine_id, main_ingredient_id, diet)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      name,
      categoryId ?? (await ensureLookup('dish_categories', 'Test Category')),
      cuisineId ?? (await ensureLookup('cuisines', 'Test Cuisine')),
      mainIngredientId,
      diet,
    ],
  );
  return rows[0];
};

export const insertMenuItem = async ({ placeId, standardDishId, name = 'Test Item', price = 200 }) => {
  const { rows } = await pool.query(
    `INSERT INTO menu_items (place_id, standard_dish_id, name, price) VALUES ($1, $2, $3, $4) RETURNING *`,
    [placeId, standardDishId, name, price],
  );
  return rows[0];
};

// Empty the test Redis DB (place / config / meta caches) between tests.
export const resetCache = async () => {
  const { redis } = await import('../../src/config/redis.js');
  await redis.flushdb();
};

// Makes a user N days old (trust level "new" lasts new_account_days).
export const ageUser = async (userId, days) => {
  await pool.query(`UPDATE users SET created_at = now() - make_interval(days => $2) WHERE id = $1`, [userId, days]);
};

export const insertHours = async (placeId, rows) => {
  for (const h of rows) {
    await pool.query('INSERT INTO opening_hours (place_id, day, opens_at, closes_at) VALUES ($1, $2, $3, $4)', [placeId, h.day, h.opensAt, h.closesAt]);
  }
};
