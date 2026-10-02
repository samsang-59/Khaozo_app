import { runner } from 'node-pg-migrate';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { closeConnections } from '../helpers/connections.js';

afterAll(closeConnections);

const EXPECTED_TABLES = [
  // People (5)
  'users', 'taste_profiles', 'taste_profile_cuisines', 'taste_profile_avoid', 'login_sessions',
  // Location (6)
  'areas', 'places', 'place_cuisines', 'opening_hours', 'place_confirmations', 'place_reports',
  // Food (6)
  'cuisines', 'dish_categories', 'main_ingredients', 'standard_dishes', 'dish_aliases', 'menu_items',
  // Contributions (5)
  'dish_ratings', 'place_reviews', 'photos', 'tags', 'place_tag_votes',
  // Personal (2)
  'private_notes', 'wishlist_items',
  // Group (2)
  'group_sessions', 'group_session_members',
  // System (1)
  'config_settings',
].sort();

const listTables = async () => {
  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name NOT IN ('pgmigrations', 'spatial_ref_sys')
     ORDER BY table_name`,
  );
  return rows.map((r) => r.table_name);
};

const migrate = (direction) =>
  runner({
    databaseUrl: env.databaseUrl,
    dir: 'migrations',
    direction,
    migrationsTable: 'pgmigrations',
    count: Infinity,
    log: () => {},
  });

describe('migrations', () => {
  test('materialized views + weights view exist', async () => {
    const { rows } = await pool.query(`SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' ORDER BY 1`);
    expect(rows.map((r) => r.matviewname)).toEqual(['menu_item_stats', 'place_stats']);
  });

  test('fresh test DB has all 27 tables', async () => {
    const tables = await listTables();
    expect(tables).toHaveLength(27);
    expect(tables).toEqual(EXPECTED_TABLES);
  });

  test('extensions postgis, vector, pg_trgm are installed', async () => {
    const { rows } = await pool.query(
      `SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'vector', 'pg_trgm') ORDER BY extname`,
    );
    expect(rows.map((r) => r.extname)).toEqual(['pg_trgm', 'postgis', 'vector']);
  });

  test('must-have rows: 15 tags and the config keys', async () => {
    const tags = await pool.query(`SELECT type, COUNT(*) AS n FROM tags GROUP BY type ORDER BY type`);
    expect(tags.rows).toEqual([
      { type: 'meal_time', n: 5 },
      { type: 'mood', n: 10 },
    ]);

    const config = await pool.query(`SELECT key, value FROM config_settings ORDER BY key`);
    const byKey = Object.fromEntries(config.rows.map((r) => [r.key, r.value]));
    expect(byKey).toMatchObject({
      bayes_prior: { mean: 3.5, weight: 5 },
      group_expiry_hours: 4,
      journal_gap_hours: 3,
      min_ratings_for_label: 5,
      new_account_days: 7,
      mixed_reviews: { maxStars: 2.5, belowOrderAgainPct: 40 },
      must_order: { minStars: 4, minOrderAgainPct: 70 },
      place_verify_threshold: 5,
      rerate_after_days: 30,
      summary_refresh_every: 5,
      tag_min_votes: 3,
      trust_weights: { new: 0.5, normal: 1.0, trusted: 2.0 },
      trusted_min_score: 2.0,
      trust_rules: { agreeWithin: 1.0, farOff: 2.5, agreeBonus: 0.05, farPenalty: 0.2, verifiedPlaceBonus: 0.1, min: 0.1, max: 3.0 },
      search_weights: { dish: 0.4, distance: 0.2, tag: 0.15, taste: 0.1, vibe: 0.1, open: 0.05 },
      search_radius_m: { start: 3000, relaxed: 6000 },
      ai_daily_limit: { gemini: 500 },
    });
    expect(byKey.rate_limits.search).toEqual({ user: [20, 60], ip: [60, 60] });
  });

  test('must-have catalog rows: cuisines, dish categories, main ingredients', async () => {
    // Ignore rows other test files create with ensureLookup ('Test …')
    const names = async (table) =>
      (await pool.query(`SELECT name FROM ${table} WHERE name NOT LIKE 'Test %' ORDER BY id`)).rows.map((r) => r.name);
    expect(await names('cuisines')).toEqual([
      'Odia', 'North Indian', 'South Indian', 'Mughlai', 'Chinese', 'Continental',
      'Street food', 'Bakery & desserts', 'Fast food', 'Beverages',
    ]);
    expect(await names('main_ingredients')).toEqual([
      'Chicken', 'Mutton', 'Fish', 'Prawn', 'Egg', 'Paneer', 'Mushroom', 'Crab', 'Chhena',
    ]);
    const categories = await names('dish_categories');
    expect(categories).toHaveLength(29);
    expect(categories).toEqual(expect.arrayContaining(['Biryani', 'Momos', 'Dosa', 'Rolls', 'Thali', 'Chhena sweets']));
  });

  test('indexes from migration 008 exist (spatial, vector, trigram)', async () => {
    const { rows } = await pool.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const defs = Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]));
    expect(defs.places_location_gist_idx).toMatch(/USING gist/);
    expect(defs.standard_dishes_embedding_hnsw_idx).toMatch(/USING hnsw .*vector_cosine_ops/);
    expect(defs.dish_aliases_alias_trgm_idx).toMatch(/USING gin .*gin_trgm_ops/);
    expect(defs.place_reports_pending_idx).toMatch(/WHERE \(status = 'pending'::text\)/);
    expect(defs.dish_ratings_one_current_idx).toMatch(/UNIQUE INDEX .* WHERE is_current/);
  });

  // Runs last in this file: proves every Down Migration works, then rebuilds.
  test('down migrations remove everything and up rebuilds it', async () => {
    await migrate('down');
    expect(await listTables()).toEqual([]);
    await migrate('up');
    expect(await listTables()).toEqual(EXPECTED_TABLES);
  }, 60000);
});
