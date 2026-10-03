// Seeds a small, self-contained world through the real API (so ranking views, labels and
// opening hours are real): one verified place near Patia with two dishes, rated by 6 diners.
import { writeFileSync, mkdirSync } from 'node:fs';
import { call, clearSearchCache, closeDb, createUser, db } from './backend.js';

export const WORLD_FILE = new URL('./.auth/world.json', import.meta.url);

export default async function globalSetup() {
  const health = await fetch((process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1') + '/health').catch(() => null);
  if (!health?.ok) throw new Error('Backend is not running on :3000 — start it first (see tests/e2e/README.md).');

  const run = Date.now().toString(36);
  const owner = await createUser('E2E Owner');
  const diners = [];
  for (let i = 0; i < 6; i += 1) diners.push(await createUser(`E2E Diner ${i + 1}`));

  const placeName = `E2E Biryani Point ${run}`;
  const place = (await call('POST', '/places', owner, { name: placeName, lat: 20.3592, lng: 85.8236, placeType: 'restaurant', dietType: 'both', priceLevel: 2, confirmNew: true })).data;
  await db().query(`UPDATE places SET status = 'verified', verified_at = now() WHERE id = $1`, [place.id]);
  const hours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opensAt: '00:00', closesAt: '23:59' }));
  await call('PUT', `/places/${place.id}/hours`, owner, { hours });

  const biryaniId = (await db().query(`SELECT id FROM standard_dishes WHERE name = 'Chicken Dum Biryani'`)).rows[0].id;
  const dalmaId = (await db().query(`SELECT id FROM standard_dishes WHERE name = 'Dalma'`)).rows[0].id;
  const biryani = (await call('POST', `/places/${place.id}/menu-items`, owner, { name: 'Chicken Dum Biryani', price: 220, standardDishId: biryaniId })).data;
  const dalma = (await call('POST', `/places/${place.id}/menu-items`, owner, { name: 'Dalma', price: 90, standardDishId: dalmaId })).data;
  for (const [i, d] of diners.entries()) {
    await call('POST', `/menu-items/${biryani.id}/ratings`, d, { stars: 4 + (i % 2), wouldOrderAgain: true, spice: 'spicy', reviewText: i === 0 ? 'Fragrant rice, properly spicy.' : null });
  }
  // Stats are materialized views → refresh now instead of waiting for the 5-min job
  await db().query('REFRESH MATERIALIZED VIEW menu_item_stats').catch(() => {});
  await db().query('REFRESH MATERIALIZED VIEW place_stats').catch(() => {});
  await clearSearchCache();

  mkdirSync(new URL('./.auth/', import.meta.url), { recursive: true });
  writeFileSync(WORLD_FILE, JSON.stringify({ placeId: place.id, placeName, biryaniItemId: biryani.id, dalmaItemId: dalma.id, biryaniDishId: biryaniId }));
  await closeDb();
}
