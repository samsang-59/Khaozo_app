import { pool } from '../../src/config/db.js';
import { importRecords } from '../../scripts/lib/placeImport.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, insertArea, ensureLookup } from '../helpers/db.js';

const record = (overrides = {}) => ({
  source: 'osm', sourceRef: 'node/1', name: 'Tarini Restaurant', lat: 20.2950, lng: 85.8240,
  placeType: 'restaurant', dietType: null, address: null, phone: null, cuisines: [],
  ...overrides,
});

let jaydevVihar;
let patia;

beforeEach(async () => {
  await resetData();
  jaydevVihar = await insertArea({ name: 'Jaydev Vihar', lat: 20.2945, lng: 85.8237 });
  patia = await insertArea({ name: 'Patia', lat: 20.3605, lng: 85.8248 });
});
afterAll(closeConnections);

const placeCount = async () => (await pool.query('SELECT COUNT(*) AS n FROM places')).rows[0].n;

describe('importRecords', () => {
  test('re-running the import does not duplicate places', async () => {
    const records = [record(), record({ sourceRef: 'node/2', name: 'Cafe Coffee Day', lat: 20.36, lng: 85.825 })];
    const first = await importRecords(pool, records);
    const second = await importRecords(pool, records);
    expect(first.inserted).toBe(2);
    expect(second).toMatchObject({ inserted: 0, sameSource: 2 });
    expect(await placeCount()).toBe(2);
  });

  test('a Foursquare place within 50 m with a similar name is merged (skipped)', async () => {
    await importRecords(pool, [record()]);
    // ~20 m away, slightly different spelling
    const stats = await importRecords(pool, [
      record({ source: 'foursquare', sourceRef: 'fsq-1', name: 'Tarini Restaurent', lat: 20.29518 }),
    ]);
    expect(stats.merged).toBe(1);
    expect(await placeCount()).toBe(1);
  });

  test('a different place at the same spot is kept', async () => {
    await importRecords(pool, [record()]);
    const stats = await importRecords(pool, [
      record({ source: 'foursquare', sourceRef: 'fsq-2', name: 'Baskin Robbins', lat: 20.29505 }),
    ]);
    expect(stats.inserted).toBe(1);
  });

  test('a similar name more than 50 m away is a separate place (chain branch)', async () => {
    await importRecords(pool, [record()]);
    const stats = await importRecords(pool, [
      record({ source: 'foursquare', sourceRef: 'fsq-3', name: 'Tarini Restaurant', lat: 20.3600, lng: 85.8250 }),
    ]);
    expect(stats.inserted).toBe(1);
  });

  test('area = nearest area pin; imported places start verified', async () => {
    await importRecords(pool, [record(), record({ sourceRef: 'node/9', name: 'KIIT Food Court', lat: 20.355, lng: 85.82 })]);
    const { rows } = await pool.query('SELECT name, area_id, status, source, verified_at IS NOT NULL AS has_verified_at FROM places ORDER BY name');
    expect(rows).toEqual([
      { name: 'KIIT Food Court', area_id: patia.id, status: 'verified', source: 'osm', has_verified_at: true },
      { name: 'Tarini Restaurant', area_id: jaydevVihar.id, status: 'verified', source: 'osm', has_verified_at: true },
    ]);
  });

  test('links known cuisines, ignores unknown ones', async () => {
    const odiaId = await ensureLookup('cuisines', 'Odia');
    await importRecords(pool, [record({ cuisines: ['Odia', 'Martian'] })]);
    const { rows } = await pool.query('SELECT cuisine_id FROM place_cuisines');
    expect(rows).toEqual([{ cuisine_id: odiaId }]);
  });

  test('places outside Bhubaneswar are skipped', async () => {
    const stats = await importRecords(pool, [record({ lat: 19.81, lng: 85.83 })]);
    expect(stats).toMatchObject({ inserted: 0, skippedOutside: 1 });
  });

  test('refuses to run before areas are seeded', async () => {
    await resetData();
    await expect(importRecords(pool, [record()])).rejects.toThrow(/npm run seed/);
  });
});
