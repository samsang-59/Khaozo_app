import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as placeRepo from '../../src/repositories/place.repo.js';
import * as configService from '../../src/services/helpers/config.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, resetCache, insertUser, insertArea, insertPlace, insertHours, ageUser, lookupId } from '../helpers/db.js';
import { accessTokenFor } from '../helpers/auth.js';

const app = createApp();
const api = '/api/v1';
const bearer = (u) => ({ Authorization: `Bearer ${accessTokenFor(u)}` });

// Fixture pins (real Bhubaneswar spots)
const KIIT = { lat: 20.3530, lng: 85.8195 };
let area;
let user;

beforeEach(async () => {
  await resetData();
  await resetCache();
  area = await insertArea({ name: 'KIIT', lat: KIIT.lat, lng: KIIT.lng });
  user = await insertUser();
  await ageUser(user.id, 30);
});
afterAll(closeConnections);

// ~111 m per 0.001° latitude
const north = (m) => KIIT.lat + m / 111_320;

describe('GET /places (near me)', () => {
  beforeEach(async () => {
    await insertPlace({ areaId: area.id, name: 'Far Cafe', lat: north(1800), lng: KIIT.lng, placeType: 'cafe' });
    await insertPlace({ areaId: area.id, name: 'Near Dhaba', lat: north(100), lng: KIIT.lng, placeType: 'dhaba' });
    await insertPlace({ areaId: area.id, name: 'Mid Bakery', lat: north(900), lng: KIIT.lng, placeType: 'bakery' });
    await insertPlace({ areaId: area.id, name: 'Too Far', lat: north(5000), lng: KIIT.lng });
  });

  test('within 2 km, nearest first, with distances', async () => {
    const res = await request(app).get(`${api}/places`).query({ ...KIIT, radius: 2000 });
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((p) => p.name)).toEqual(['Near Dhaba', 'Mid Bakery', 'Far Cafe']);
    const d = res.body.data.items.map((p) => p.distanceM);
    expect(d[0]).toBeGreaterThan(90);
    expect(d[0]).toBeLessThan(110);
    expect(d[2]).toBeLessThan(2000);
  });

  test('closed and soft-deleted places are hidden', async () => {
    await pool.query(`UPDATE places SET status = 'closed' WHERE name = 'Near Dhaba'`);
    await pool.query(`UPDATE places SET deleted_at = now() WHERE name = 'Mid Bakery'`);
    const res = await request(app).get(`${api}/places`).query({ ...KIIT, radius: 2000 });
    expect(res.body.data.items.map((p) => p.name)).toEqual(['Far Cafe']);
  });

  test('cursor pagination walks the list without repeats', async () => {
    const first = await request(app).get(`${api}/places`).query({ ...KIIT, radius: 2000, limit: 2 });
    expect(first.body.data.items).toHaveLength(2);
    const second = await request(app).get(`${api}/places`).query({ ...KIIT, radius: 2000, limit: 2, cursor: first.body.data.nextCursor });
    expect(second.body.data.items.map((p) => p.name)).toEqual(['Far Cafe']);
    expect(second.body.data.nextCursor).toBeNull();
  });

  test('filters: type, status=unverified, name search, area as centre', async () => {
    const byType = await request(app).get(`${api}/places`).query({ ...KIIT, radius: 2000, type: 'bakery' });
    expect(byType.body.data.items.map((p) => p.name)).toEqual(['Mid Bakery']);

    await pool.query(`UPDATE places SET status = 'verified' WHERE name <> 'Far Cafe'`);
    const unverified = await request(app).get(`${api}/places`).query({ status: 'unverified' });
    expect(unverified.body.data.items.map((p) => p.name)).toEqual(['Far Cafe']);

    const byName = await request(app).get(`${api}/places`).query({ q: 'bakry' }); // typo still matches (pg_trgm)
    expect(byName.body.data.items.map((p) => p.name)).toEqual(['Mid Bakery']);

    const byArea = await request(app).get(`${api}/places`).query({ areaId: area.id, radius: 2000 });
    expect(byArea.body.data.items[0].name).toBe('Near Dhaba');
  });

  test('invalid query → 400', async () => {
    expect((await request(app).get(`${api}/places`).query({ lat: 20.3 })).status).toBe(400);
    expect((await request(app).get(`${api}/places`).query({ cursor: 'garbage!!' })).status).toBe(400);
  });
});

describe('open now (SQL filter matches the JS status)', () => {
  const ist = (local) => new Date(`${local}:00+05:30`);
  let lateNight;
  let twoShifts;

  beforeEach(async () => {
    lateNight = await insertPlace({ areaId: area.id, name: 'Late Night Rolls', lat: north(100), lng: KIIT.lng });
    twoShifts = await insertPlace({ areaId: area.id, name: 'Two Shift Tiffin', lat: north(200), lng: KIIT.lng });
    await insertPlace({ areaId: area.id, name: 'Unknown Hours', lat: north(300), lng: KIIT.lng });
    await insertHours(lateNight.id, [{ day: 5, opensAt: '18:00', closesAt: '02:00' }]); // Fri → Sat 2 AM
    await insertHours(twoShifts.id, [
      { day: 1, opensAt: '08:00', closesAt: '11:00' },
      { day: 1, opensAt: '17:00', closesAt: '22:00' },
    ]);
  });

  const openAt = async (at) =>
    (await placeRepo.list({ ...KIIT, radiusM: 2000, openNow: true, at, limit: 20 })).map((p) => p.name);

  test('after-midnight place is open late Friday and at 1:30 AM Saturday', async () => {
    expect(await openAt(ist('2026-10-02T23:30'))).toEqual(['Late Night Rolls']);
    expect(await openAt(ist('2026-10-03T01:30'))).toEqual(['Late Night Rolls']);
    expect(await openAt(ist('2026-10-03T02:30'))).toEqual([]);
  });

  test('two shifts: open in each shift, closed in between', async () => {
    expect(await openAt(ist('2026-10-05T09:00'))).toEqual(['Two Shift Tiffin']);
    expect(await openAt(ist('2026-10-05T12:00'))).toEqual([]);
    expect(await openAt(ist('2026-10-05T18:00'))).toEqual(['Two Shift Tiffin']);
  });

  test('unknown hours are never "open now" but still listed normally', async () => {
    const all = await request(app).get(`${api}/places`).query({ ...KIIT, radius: 2000 });
    const unknown = all.body.data.items.find((p) => p.name === 'Unknown Hours');
    expect(unknown.opening).toEqual({ state: 'unknown' });
  });
});

describe('GET /places/:id', () => {
  test('details with hours, opening status and verification progress', async () => {
    const place = await insertPlace({ areaId: area.id, name: 'Tarini', lat: KIIT.lat, lng: KIIT.lng });
    const res = await request(app).get(`${api}/places/${place.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: place.id, name: 'Tarini', status: 'unverified', area: { name: 'KIIT' },
      hours: [], opening: { state: 'unknown' }, verification: { confirmations: 0, threshold: 5 }, stats: null,
    });
    expect(res.body.data.me).toBeUndefined(); // guest
  });

  test('logged in → personal part (never cached)', async () => {
    const place = await insertPlace({ areaId: area.id, name: 'Tarini', lat: KIIT.lat, lng: KIIT.lng });
    const res = await request(app).get(`${api}/places/${place.id}`).set(bearer(user));
    expect(res.body.data.me).toEqual({ isAdder: false, hasConfirmed: false });
  });

  test('soft-deleted or missing → 404', async () => {
    const place = await insertPlace({ areaId: area.id });
    await pool.query('UPDATE places SET deleted_at = now() WHERE id = $1', [place.id]);
    expect((await request(app).get(`${api}/places/${place.id}`)).status).toBe(404);
    expect((await request(app).get(`${api}/places/999999`)).status).toBe(404);
  });
});

describe('POST /places (add + duplicate prompt)', () => {
  const body = { name: 'Tarini Restaurant', lat: KIIT.lat, lng: KIIT.lng, placeType: 'restaurant' };

  test('creates an unverified user place in the nearest area', async () => {
    const res = await request(app).post(`${api}/places`).set(bearer(user)).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Tarini Restaurant', status: 'unverified', source: 'user', area: { name: 'KIIT' } });
    expect(res.body.data.me.isAdder).toBe(true);
  });

  test('similar name within 50 m → 409 with candidates; confirmNew=true → created', async () => {
    await insertPlace({ areaId: area.id, name: 'Tarini Restaurant', lat: north(20), lng: KIIT.lng });
    const res = await request(app).post(`${api}/places`).set(bearer(user)).send({ ...body, name: 'Tarini Restaurent' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('POSSIBLE_DUPLICATE');
    expect(res.body.error.details.candidates[0]).toMatchObject({ name: 'Tarini Restaurant' });
    expect(res.body.error.details.candidates[0].distanceM).toBeLessThan(50);

    const forced = await request(app).post(`${api}/places`).set(bearer(user)).send({ ...body, name: 'Tarini Restaurent', confirmNew: true });
    expect(forced.status).toBe(201);
  });

  test('same name more than 50 m away is not a duplicate', async () => {
    await insertPlace({ areaId: area.id, name: 'Tarini Restaurant', lat: north(200), lng: KIIT.lng });
    expect((await request(app).post(`${api}/places`).set(bearer(user)).send(body)).status).toBe(201);
  });

  test('outside Bhubaneswar → 400; needs login → 401', async () => {
    const puri = await request(app).post(`${api}/places`).set(bearer(user)).send({ ...body, lat: 19.81, lng: 85.83 });
    expect(puri.body.error.code).toBe('OUTSIDE_SERVICE_AREA');
    expect((await request(app).post(`${api}/places`).send(body)).status).toBe(401);
  });
});

describe('POST /places/:id/confirm', () => {
  let adder;
  let place;
  beforeEach(async () => {
    adder = await insertUser();
    place = (await request(app).post(`${api}/places`).set(bearer(adder)).send({ name: 'New Stall', lat: KIIT.lat, lng: KIIT.lng, placeType: 'street_stall' })).body.data;
  });

  const confirmers = async (n, days = 30) => {
    const list = [];
    for (let i = 0; i < n; i += 1) {
      const u = await insertUser();
      await ageUser(u.id, days);
      list.push(u);
    }
    return list;
  };
  const confirm = (u) => request(app).post(`${api}/places/${place.id}/confirm`).set(bearer(u));

  test('five normal users (weight 1.0) verify the place', async () => {
    const users = await confirmers(5);
    for (const u of users.slice(0, 4)) expect((await confirm(u)).body.data.verified).toBe(false);
    const last = await confirm(users[4]);
    expect(last.body.data).toMatchObject({ weight: 1, level: 'normal', confirmations: 5, verified: true });
    const { rows } = await pool.query('SELECT status, verified_at FROM places WHERE id = $1', [place.id]);
    expect(rows[0].status).toBe('verified');
    expect(rows[0].verified_at).not.toBeNull();
  });

  test('new accounts count 0.5, so five of them are not enough', async () => {
    const users = await confirmers(5, 1);
    let res;
    for (const u of users) res = await confirm(u);
    expect(res.body.data).toMatchObject({ level: 'new', weight: 0.5, confirmations: 2.5, verified: false });
  });

  test('trusted users count 2.0 (three verify it)', async () => {
    const users = await confirmers(3);
    await pool.query('UPDATE users SET trust_score = 2.5 WHERE id = ANY($1::bigint[])', [users.map((u) => u.id)]);
    let res;
    for (const u of users) res = await confirm(u);
    expect(res.body.data).toMatchObject({ level: 'trusted', confirmations: 6, verified: true });
  });

  test('cannot confirm your own place; one confirmation per user', async () => {
    expect((await confirm(adder)).body.error.code).toBe('CANNOT_CONFIRM_OWN_PLACE');
    expect((await confirm(user)).status).toBe(201);
    expect((await confirm(user)).body.error.code).toBe('ALREADY_CONFIRMED');
  });

  test('already verified places need no confirmations', async () => {
    await pool.query(`UPDATE places SET status = 'verified' WHERE id = $1`, [place.id]);
    expect((await confirm(user)).body.error.code).toBe('PLACE_NOT_UNVERIFIED');
  });

  test('confirmation weight is a snapshot (later trust changes do not alter it)', async () => {
    await confirm(user);
    await pool.query('UPDATE users SET trust_score = 3 WHERE id = $1', [user.id]);
    const { rows } = await pool.query('SELECT weight FROM place_confirmations WHERE confirmed_by = $1', [user.id]);
    expect(rows[0].weight).toBe(1);
  });
});

describe('PUT /places/:id/hours', () => {
  test('anyone logged in can add hours only while none exist', async () => {
    const place = await insertPlace({ areaId: area.id });
    const hours = [{ day: 1, opensAt: '08:00', closesAt: '11:00' }, { day: 1, opensAt: '17:00', closesAt: '22:00' }];
    const first = await request(app).put(`${api}/places/${place.id}/hours`).set(bearer(user)).send({ hours });
    expect(first.status).toBe(201);
    expect(first.body.data.hours).toHaveLength(2);
    const second = await request(app).put(`${api}/places/${place.id}/hours`).set(bearer(user)).send({ hours });
    expect(second.body.error.code).toBe('HOURS_ALREADY_SET');
  });

  test('rejects bad times and more than two shifts a day', async () => {
    const place = await insertPlace({ areaId: area.id });
    const put = (hours) => request(app).put(`${api}/places/${place.id}/hours`).set(bearer(user)).send({ hours });
    expect((await put([{ day: 1, opensAt: '25:00', closesAt: '11:00' }])).status).toBe(400);
    expect((await put([{ day: 1, opensAt: '09:00', closesAt: '09:00' }])).status).toBe(400);
    expect((await put([1, 2, 3].map(() => ({ day: 2, opensAt: '08:00', closesAt: '09:00' })))).status).toBe(400);
  });
});

describe('POST /places/:id/reports', () => {
  let place;
  beforeEach(async () => {
    place = await insertPlace({ areaId: area.id, name: 'Old Cafe' });
  });
  const report = (body) => request(app).post(`${api}/places/${place.id}/reports`).set(bearer(user)).send(body);

  test('creates a pending report', async () => {
    const res = await report({ reason: 'wrong_hours', suggestedChange: { hours: [{ day: 1, opensAt: '09:00', closesAt: '21:00' }] } });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ reason: 'wrong_hours', status: 'pending' });
  });

  test('duplicate needs a real, different duplicateOf', async () => {
    expect((await report({ reason: 'duplicate' })).status).toBe(400);
    expect((await report({ reason: 'duplicate', duplicateOf: place.id })).body.error.code).toBe('DUPLICATE_OF_SELF');
    expect((await report({ reason: 'duplicate', duplicateOf: 999999 })).body.error.code).toBe('DUPLICATE_TARGET_NOT_FOUND');
    const other = await insertPlace({ areaId: area.id, name: 'Old Cafe 2' });
    expect((await report({ reason: 'duplicate', duplicateOf: other.id })).status).toBe(201);
  });

  test('one pending report per user, place and reason', async () => {
    expect((await report({ reason: 'closed' })).status).toBe(201);
    expect((await report({ reason: 'closed' })).body.error.code).toBe('REPORT_ALREADY_PENDING');
    expect((await report({ reason: 'not_found' })).status).toBe(201);
  });
});

describe('configService', () => {
  test('reads config through the Redis cache (config:all)', async () => {
    expect(await configService.get('place_verify_threshold')).toBe(5);
    await pool.query(`UPDATE config_settings SET value = '7' WHERE key = 'place_verify_threshold'`);
    expect(await configService.get('place_verify_threshold')).toBe(5); // still cached
    await configService.clearCache();
    expect(await configService.get('place_verify_threshold')).toBe(7);
    await pool.query(`UPDATE config_settings SET value = '5' WHERE key = 'place_verify_threshold'`);
    await configService.clearCache();
  });
});

describe('meta + menu', () => {
  test('meta lists come from the DB (and are cached)', async () => {
    const res = await request(app).get(`${api}/cuisines`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.name)).toEqual(expect.arrayContaining(['Odia', 'Fast food', 'Beverages']));
    expect((await request(app).get(`${api}/tags`)).body.data).toHaveLength(15);
    expect((await request(app).get(`${api}/areas`)).body.data[0]).toMatchObject({ name: 'KIIT', lat: expect.any(Number) });
  });

  test('menu lists active items with their standard dish', async () => {
    const place = await insertPlace({ areaId: area.id });
    const odia = await lookupId('cuisines', 'Odia');
    const thali = await lookupId('dish_categories', 'Thali');
    const { rows } = await pool.query(
      `INSERT INTO standard_dishes (name, category_id, cuisine_id, diet) VALUES ('Odia Veg Thali', $1, $2, 'veg') RETURNING id`,
      [thali, odia],
    );
    await pool.query(`INSERT INTO menu_items (place_id, standard_dish_id, name, price) VALUES ($1, $2, 'Thali', 150), ($1, $2, 'Old Thali', 120)`, [place.id, rows[0].id]);
    await pool.query(`UPDATE menu_items SET status = 'removed' WHERE name = 'Old Thali'`);
    const res = await request(app).get(`${api}/places/${place.id}/menu`);
    expect(res.body.data).toEqual([expect.objectContaining({ name: 'Thali', price: 150, standardDish: 'Odia Veg Thali', diet: 'veg', category: 'Thali' })]);
  });
});
