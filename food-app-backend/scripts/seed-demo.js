// npm run seed:demo — LOCAL DEMO DATA ONLY: makes your laptop copy look lived-in (menus, ratings,
// reviews, photos, "Good for" tags, opening hours) for about half of the imported places.
//   npm run seed:demo            add demo data (replaces earlier demo data — safe to run twice)
//   npm run seed:demo -- --remove   remove all demo data again
// Refuses to run in production, on the test DB, or on a non-local database.
// Everything demo is traceable: demo users (@demo.khaozo.local) own every demo rating, review,
// tag vote and menu item (photos hang off their ratings / reviews, public id 'demo/…', and are
// links to free food photos — nothing is uploaded); demo opening hours carry created_at = 2000-01-01.
import { pathToFileURL } from 'node:url';
import { env } from '../src/config/env.js';
import { pool, withTransaction, closeDb } from '../src/config/db.js';
import { closeRedis } from '../src/config/redis.js';
import * as statsRepo from '../src/repositories/stats.repo.js';
import * as cacheRepo from '../src/repositories/redis/cache.repo.js';
import { planDemo, DEMO_USER_NAMES } from './lib/demoPlan.js';

export const DEMO_EMAIL_DOMAIN = 'demo.khaozo.local';
const DEMO_HOURS_MARK = '2000-01-01T00:00:00Z';

// → null when it is safe, else why not
export const unsafeReason = ({ nodeEnv, database, databaseUrl }) => {
  if (nodeEnv === 'production') return 'NODE_ENV is production';
  if (database === 'food_app_test') return 'this is the test database';
  const host = new URL(databaseUrl).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) return `database host "${host}" is not this computer`;
  return null;
};

const removeDemo = async (client) => {
  const demo = `SELECT id FROM users WHERE email LIKE '%@${DEMO_EMAIL_DOMAIN}'`;
  // Ratings / reviews would otherwise stay behind anonymised (FK SET NULL) — delete them first
  const ratings = await client.query(`DELETE FROM dish_ratings WHERE user_id IN (${demo})`);
  const reviews = await client.query(`DELETE FROM place_reviews WHERE user_id IN (${demo})`);
  // Demo menu items, unless a real person has rated / saved / noted them meanwhile
  const items = await client.query(
    `DELETE FROM menu_items m WHERE m.added_by IN (${demo})
       AND NOT EXISTS (SELECT 1 FROM dish_ratings r WHERE r.menu_item_id = m.id)`,
  );
  const hours = await client.query('DELETE FROM opening_hours WHERE created_at = $1', [DEMO_HOURS_MARK]);
  const users = await client.query(`DELETE FROM users WHERE email LIKE '%@${DEMO_EMAIL_DOMAIN}'`); // tag votes, profiles cascade
  return { users: users.rowCount, menuItems: items.rowCount, ratings: ratings.rowCount, reviews: reviews.rowCount, hours: hours.rowCount };
};

const insertRows = async (client, table, columns, rows, casts) => {
  if (!rows.length) return [];
  const arrays = columns.map(([, key]) => rows.map((r) => r[key] ?? null));
  const { rows: out } = await client.query(
    `INSERT INTO ${table} (${columns.map(([c]) => c).join(', ')})
     SELECT * FROM unnest(${columns.map((_, i) => `$${i + 1}::${casts[i]}[]`).join(', ')})
     RETURNING *`,
    arrays,
  );
  return out;
};

const addDemo = async (client) => {
  // Demo users (90 days old → normal trust weight) with empty taste profiles
  const users = [];
  for (const [i, name] of DEMO_USER_NAMES.entries()) {
    const { rows } = await client.query(
      `INSERT INTO users (name, email, google_id, created_at) VALUES ($1, $2, $3, now() - interval '90 days') RETURNING id`,
      [name, `demo${i + 1}@${DEMO_EMAIL_DOMAIN}`, `demo-${i + 1}`],
    );
    users.push(rows[0].id);
  }
  await client.query('INSERT INTO taste_profiles (user_id) SELECT unnest($1::bigint[])', [users]);

  const { rows: places } = await client.query(
    `SELECT p.id, p.name, p.place_type, p.diet_type,
            EXISTS (SELECT 1 FROM opening_hours h WHERE h.place_id = p.id) AS has_hours,
            COALESCE((SELECT array_agg(m.standard_dish_id) FROM menu_items m WHERE m.place_id = p.id), '{}') AS existing_dish_ids
     FROM places p WHERE p.deleted_at IS NULL AND p.status <> 'closed' ORDER BY p.id`,
  );
  const { rows: dishes } = await client.query(
    `SELECT d.id, d.name, d.diet, c.name AS category FROM standard_dishes d JOIN dish_categories c ON c.id = d.category_id
     WHERE d.status = 'active' ORDER BY d.id`,
  );
  const dishesByCategory = {};
  for (const d of dishes) (dishesByCategory[d.category] ??= []).push(d);
  const { rows: tags } = await client.query(`SELECT id, name FROM tags WHERE type = 'mood'`);

  const plan = planDemo({
    places: places.map((p) => ({ id: p.id, name: p.name, placeType: p.place_type, dietType: p.diet_type, hasHours: p.has_hours, existingDishIds: p.existing_dish_ids })),
    dishesByCategory,
    userIds: users,
    tagIds: Object.fromEntries(tags.map((t) => [t.name, t.id])),
  });

  const items = await insertRows(client, 'menu_items',
    [['place_id', 'placeId'], ['standard_dish_id', 'standardDishId'], ['name', 'name'], ['price', 'price'], ['added_by', 'addedBy']],
    plan.menuItems, ['bigint', 'bigint', 'text', 'int', 'bigint']);
  const itemId = new Map(items.map((m) => [`${m.place_id}|${m.name}`, m.id]));
  const ratings = plan.ratings.map((r) => ({ ...r, menuItemId: itemId.get(`${r.placeId}|${r.name}`) }));

  const savedRatings = await insertRows(client, 'dish_ratings',
    [['user_id', 'userId'], ['menu_item_id', 'menuItemId'], ['stars', 'stars'], ['would_order_again', 'wouldOrderAgain'],
      ['taste', 'taste'], ['portion', 'portion'], ['value', 'value'], ['spice', 'spice'], ['sweetness', 'sweetness'],
      ['oiliness', 'oiliness'], ['review_text', 'reviewText'], ['price_paid', 'pricePaid'], ['created_at', 'createdAt'], ['updated_at', 'createdAt']],
    ratings, ['bigint', 'bigint', 'smallint', 'boolean', 'smallint', 'smallint', 'smallint', 'text', 'text', 'text', 'text', 'int', 'timestamptz', 'timestamptz']);
  const savedReviews = await insertRows(client, 'place_reviews',
    [['user_id', 'userId'], ['place_id', 'placeId'], ['stars', 'stars'], ['vibe', 'vibe'], ['looks', 'looks'],
      ['service_speed', 'serviceSpeed'], ['staff', 'staff'], ['hygiene', 'hygiene'], ['noise', 'noise'], ['crowd', 'crowd'],
      ['wifi', 'wifi'], ['plug_points', 'plugPoints'], ['ac', 'ac'], ['washroom', 'washroom'], ['bike_parking', 'bikeParking'],
      ['car_parking', 'carParking'], ['accepts_cash', 'acceptsCash'], ['accepts_upi', 'acceptsUpi'], ['accepts_card', 'acceptsCard'],
      ['review_text', 'reviewText'], ['created_at', 'createdAt'], ['updated_at', 'createdAt']],
    plan.reviews, ['bigint', 'bigint', 'smallint', 'smallint', 'smallint', 'smallint', 'smallint', 'smallint', 'text', 'text',
      'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'boolean', 'text', 'timestamptz', 'timestamptz']);
  // Photos: links to free food photos (no Cloudinary upload). cloudinary_public_id 'demo/…' marks
  // them; they go away with their demo rating / review (ON DELETE CASCADE).
  const ratingId = new Map(savedRatings.map((r) => [`${r.user_id}|${r.menu_item_id}`, r.id]));
  const reviewId = new Map(savedReviews.map((r) => [`${r.user_id}|${r.place_id}`, r.id]));
  const photos = [
    ...ratings.flatMap((r) => r.photos.map((url) => ({ url, ratingId: ratingId.get(`${r.userId}|${r.menuItemId}`) }))),
    ...plan.reviews.flatMap((r) => r.photos.map((url) => ({ url, reviewId: reviewId.get(`${r.userId}|${r.placeId}`) }))),
  ].map((ph, i) => ({ ...ph, publicId: `demo/${i + 1}` }));
  await insertRows(client, 'photos',
    [['url', 'url'], ['cloudinary_public_id', 'publicId'], ['dish_rating_id', 'ratingId'], ['place_review_id', 'reviewId']],
    photos, ['text', 'text', 'bigint', 'bigint']);

  await insertRows(client, 'place_tag_votes',
    [['place_id', 'placeId'], ['tag_id', 'tagId'], ['user_id', 'userId'], ['source', 'source']],
    plan.tagVotes.map((v) => ({ ...v, source: 'user' })), ['bigint', 'bigint', 'bigint', 'text']);
  await insertRows(client, 'opening_hours',
    [['place_id', 'placeId'], ['day', 'day'], ['opens_at', 'opensAt'], ['closes_at', 'closesAt'], ['created_at', 'mark']],
    plan.hours.map((h) => ({ ...h, mark: DEMO_HOURS_MARK })), ['bigint', 'smallint', 'time', 'time', 'timestamptz']);

  return {
    users: users.length,
    places: new Set(plan.menuItems.map((m) => m.placeId)).size,
    menuItems: items.length,
    ratings: ratings.length,
    reviews: plan.reviews.length,
    photos: photos.length,
    tagVotes: plan.tagVotes.length,
    hours: plan.hours.length,
  };
};

const main = async () => {
  const { rows } = await pool.query('SELECT current_database() AS name');
  const problem = unsafeReason({ nodeEnv: env.nodeEnv, database: rows[0].name, databaseUrl: env.databaseUrl });
  if (problem) throw new Error(`[seed:demo] refusing to run: ${problem}`);

  const removeOnly = process.argv.includes('--remove');
  const result = await withTransaction(async (client) => {
    const removed = await removeDemo(client);
    return removeOnly ? { removed } : { removed, added: await addDemo(client) };
  });

  await statsRepo.refresh(); // labels, rankings, "Good for" tags
  await Promise.all(['search:', 'place:'].map((p) => cacheRepo.delByPrefix(p)));
  console.log('[seed:demo] removed', result.removed);
  if (result.added) console.log('[seed:demo] added', result.added);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([closeDb(), closeRedis()]);
  }
}
