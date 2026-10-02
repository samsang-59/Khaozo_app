// Group mode end-to-end: real HTTP server + Socket.IO, fake members with socket.io-client.
import http from 'node:http';
import request from 'supertest';
import { Server } from 'socket.io';
import { io as connectClient } from 'socket.io-client';
import { createApp } from '../../src/app.js';
import { attachGroupSockets } from '../../src/sockets/group.socket.js';
import { pool } from '../../src/config/db.js';
import * as configService from '../../src/services/helpers/config.js';
import { pickWinner } from '../../src/services/group.service.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, resetCache, insertUser, insertArea, insertPlace, lookupId } from '../helpers/db.js';
import { accessTokenFor } from '../helpers/auth.js';

const app = createApp();
let server;
let io;
let sockets;
let url;
const clients = [];

const SPOT = { lat: 20.2887, lng: 85.8488, label: 'Saheed Nagar' };
const north = (m) => SPOT.lat + m / 111_320;
let places;

beforeAll(async () => {
  server = http.createServer(app);
  io = new Server(server);
  sockets = attachGroupSockets(io, { rateLimits: false });
  await new Promise((r) => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;
  await pool.query(`UPDATE config_settings SET value = '1' WHERE key = 'group_creator_grace_seconds'`);
});
beforeEach(async () => {
  await resetData();
  await resetCache();
  await configService.clearCache();
  const area = await insertArea({ name: 'Saheed Nagar', ...SPOT });
  const odia = await lookupId('cuisines', 'Odia');
  const mk = async (name, m, dietType, priceLevel) => {
    const p = await insertPlace({ areaId: area.id, name, lat: north(m), lng: SPOT.lng });
    await pool.query('UPDATE places SET diet_type = $2, price_level = $3 WHERE id = $1', [p.id, dietType, priceLevel]);
    return p;
  };
  places = {
    veg: await mk('Pure Veg Bhojanalaya', 200, 'pure_veg', 1),
    both: await mk('Family Dhaba', 400, 'both', 2),
    nonveg: await mk('Kebab Corner', 300, 'non_veg', 3),
    fancy: await mk('Rooftop Grill', 600, 'non_veg', 4),
  };
  await pool.query('INSERT INTO place_cuisines (place_id, cuisine_id) VALUES ($1, $2)', [places.veg.id, odia]);
});
afterEach(() => {
  while (clients.length) clients.pop().disconnect();
});
afterAll(async () => {
  await pool.query(`UPDATE config_settings SET value = '60' WHERE key = 'group_creator_grace_seconds'`);
  sockets.close();
  io.close();
  await new Promise((r) => server.close(r));
  await closeConnections();
});

// ---- helpers
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const connect = (token) =>
  new Promise((resolve, reject) => {
    const s = connectClient(url, { auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false });
    clients.push(s);
    s.latest = null;
    s.on('group:state', (st) => { s.latest = st; });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
const emit = (s, event, payload) => new Promise((resolve) => (payload === undefined ? s.emit(event, resolve) : s.emit(event, payload, resolve)));
const waitFor = (s, event, pred = () => true, ms = 3000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    const h = (data) => {
      if (pred(data)) {
        clearTimeout(t);
        s.off(event, h);
        resolve(data);
      }
    };
    s.on(event, h);
  });

// Creator (logged in) + friend (logged in) + guest, all connected and in the room
const setupGroup = async () => {
  const [alice, bob] = [await insertUser({ name: 'Alice' }), await insertUser({ name: 'Bob' })];
  const aliceToken = accessTokenFor(alice);
  const bobToken = accessTokenFor(bob);
  const created = await request(app).post('/api/v1/groups').set(bearer(aliceToken)).send({});
  const code = created.body.data.code;
  await request(app).post(`/api/v1/groups/${code}/join`).set(bearer(bobToken)).send({});
  const guest = await request(app).post(`/api/v1/groups/${code}/join`).send({ name: 'Chotu' });
  const guestPass = guest.body.data.guestPass;
  const a = await connect(aliceToken);
  const b = await connect(bobToken);
  const g = await connect(guestPass);
  for (const s of [a, b, g]) expect(await emit(s, 'group:join', { code })).toEqual({ ok: true });
  return { code, alice, bob, a, b, g, aliceToken, bobToken, guestPass, memberIds: { a: `u${alice.id}`, b: `u${bob.id}` } };
};

const readyUp = async ({ a, b, g }, prefs = {}) => {
  await emit(a, 'group:set_preferences', { mode: 'for_now', diet: 'non_veg', budget: 4, ...prefs.a });
  await emit(b, 'group:set_preferences', { mode: 'for_now', diet: 'veg', budget: 2, ...prefs.b });
  if (g) await emit(g, 'group:set_preferences', { mode: 'for_now', ...prefs.g });
};

const suggest = async (ctx) => {
  await emit(ctx.a, 'group:set_location', { mode: 'spot', ...SPOT });
  const got = waitFor(ctx.b, 'group:suggestions');
  expect(await emit(ctx.a, 'group:start_suggestions')).toEqual({ ok: true });
  return got;
};

// ---- tests
describe('socket auth', () => {
  test('access token connects; bad token is refused', async () => {
    const u = await insertUser();
    await expect(connect(accessTokenFor(u))).resolves.toBeDefined();
    await expect(connect('garbage')).rejects.toMatchObject({ message: 'UNAUTHORIZED' });
  });

  test('a guest pass works only for its own group', async () => {
    const ctx = await setupGroup();
    const other = await request(app).post('/api/v1/groups').send({ name: 'Host' });
    const res = await emit(ctx.g, 'group:join', { code: other.body.data.code });
    expect(res.error.code).toBe('GUEST_PASS_OTHER_GROUP');
  });

  test('a guest pass cannot be used on normal routes', async () => {
    const ctx = await setupGroup();
    expect((await request(app).get('/api/v1/me').set(bearer(ctx.guestPass))).status).toBe(401);
  });
});

describe('lobby', () => {
  test('full snapshot after every change; no private preferences in it', async () => {
    const ctx = await setupGroup();
    const next = waitFor(ctx.b, 'group:state', (st) => st.readyCount === 1);
    await emit(ctx.a, 'group:set_preferences', { mode: 'for_now', diet: 'veg', budget: 2 });
    const st = await next;
    expect(st.members.map((m) => [m.name, m.ready, m.isCreator, m.isGuest])).toEqual([
      ['Alice', true, true, false], ['Bob', false, false, false], ['Chotu', false, false, true],
    ]);
    expect(JSON.stringify(st)).not.toMatch(/budget|diet|@example\.com/);
  });

  test('"Get suggestions" only by the creator, once ≥ 2 are ready and a location is set', async () => {
    const ctx = await setupGroup();
    await emit(ctx.a, 'group:set_preferences', { mode: 'for_now' });
    expect((await emit(ctx.a, 'group:start_suggestions')).error.code).toBe('NOT_ENOUGH_READY');
    await emit(ctx.b, 'group:set_preferences', { mode: 'for_now' });
    expect((await emit(ctx.b, 'group:start_suggestions')).error.code).toBe('NOT_CREATOR');
    expect((await emit(ctx.a, 'group:start_suggestions')).error.code).toBe('LOCATION_REQUIRED');
    expect((await emit(ctx.b, 'group:set_location', { mode: 'spot', ...SPOT })).error.code).toBe('NOT_CREATOR');
  });

  test('guests cannot use "my taste profile"; bad payloads → VALIDATION_ERROR', async () => {
    const ctx = await setupGroup();
    expect((await emit(ctx.g, 'group:set_preferences', { mode: 'profile' })).error.code).toBe('GUEST_HAS_NO_PROFILE');
    expect((await emit(ctx.a, 'group:set_preferences', { mode: 'whatever' })).error.code).toBe('VALIDATION_ERROR');
  });

  test('max 10 members', async () => {
    const created = await request(app).post('/api/v1/groups').send({ name: 'Host' });
    const code = created.body.data.code;
    for (let i = 0; i < 9; i += 1) expect((await request(app).post(`/api/v1/groups/${code}/join`).send({ name: `G${i}` })).status).toBe(200);
    const eleventh = await request(app).post(`/api/v1/groups/${code}/join`).send({ name: 'Late' });
    expect(eleventh.body.error.code).toBe('GROUP_FULL');
  });

  test('HTTP: guest join needs a name; unknown code → 404; rejoin is idempotent', async () => {
    const ctx = await setupGroup();
    expect((await request(app).post(`/api/v1/groups/${ctx.code}/join`).send({})).body.error.code).toBe('GUEST_NAME_REQUIRED');
    expect((await request(app).get('/api/v1/groups/ZZZZZZ')).status).toBe(404);
    const again = await request(app).post(`/api/v1/groups/${ctx.code}/join`).set(bearer(ctx.bobToken)).send({});
    expect(again.body.data.group.members).toHaveLength(3);
  });
});

describe('suggestions', () => {
  test('3–5 places with reasons, sent to everyone; strict veg removes non-veg places', async () => {
    const ctx = await setupGroup();
    await readyUp(ctx, { b: { strict: { diet: true } } });
    const suggestions = await suggest(ctx);
    const names = suggestions.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['Pure Veg Bhojanalaya', 'Family Dhaba']));
    expect(names).not.toContain('Kebab Corner');
    expect(suggestions[0]).toMatchObject({ reason: expect.stringMatching(/m$|km$/), matchPct: expect.any(Number) });
    expect(ctx.a.latest.status).toBe('voting');
  });

  test('preferences (not strict) only lower the rank; mixed diets boost places serving both', async () => {
    const ctx = await setupGroup();
    await readyUp(ctx);
    const suggestions = await suggest(ctx);
    expect(suggestions.map((s) => s.name)).toContain('Kebab Corner');
    expect(suggestions[0].name).toBe('Family Dhaba');
  });

  test('fair midpoint = centroid of shared member locations', async () => {
    const ctx = await setupGroup();
    await readyUp(ctx, { a: { location: { lat: north(0), lng: SPOT.lng } }, b: { location: { lat: north(800), lng: SPOT.lng } } });
    await emit(ctx.a, 'group:set_location', { mode: 'midpoint' });
    await emit(ctx.a, 'group:start_suggestions');
    expect(ctx.a.latest.location.lat).toBeCloseTo(north(400), 4);
  });
});

describe('voting', () => {
  test('re-vote overwrites; everyone voted → ends automatically; history saved', async () => {
    const ctx = await setupGroup();
    await readyUp(ctx);
    const suggestions = await suggest(ctx);
    const [first, second] = suggestions.map((s) => s.placeId);

    await emit(ctx.a, 'group:vote', { placeId: first });
    await emit(ctx.a, 'group:vote', { placeId: second }); // changed mind
    // the snapshot reaches the phone before the ack, so it is already the latest one
    expect(ctx.a.latest.voteCounts).toEqual({ [second]: 1 });
    await emit(ctx.b, 'group:vote', { placeId: second });
    const result = waitFor(ctx.g, 'group:result');
    await emit(ctx.g, 'group:vote', { placeId: first });
    expect(await result).toMatchObject({ placeId: second, votes: 2, decidedBy: 'votes' });
    expect(ctx.a.latest.status).toBe('done');

    const { rows } = await pool.query(
      `SELECT g.code, g.guest_count, g.winning_place_id, g.location_label, g.created_by,
              (SELECT array_agg(user_id ORDER BY user_id) FROM group_session_members WHERE group_session_id = g.id) AS members
       FROM group_sessions g`,
    );
    expect(rows).toEqual([{
      code: ctx.code, guest_count: 1, winning_place_id: second, location_label: 'Saheed Nagar',
      created_by: ctx.alice.id, members: [ctx.alice.id, ctx.bob.id].sort((x, y) => x - y),
    }]);
    const history = await request(app).get('/api/v1/me/groups').set(bearer(ctx.bobToken));
    expect(history.body.data[0]).toMatchObject({ code: ctx.code, guestCount: 1, memberCount: 2, wasCreator: false });
    expect((await request(app).get(`/api/v1/groups/${ctx.code}`)).body.data.status).toBe('done');
  });

  test('tie → higher match score wins; creator can override early', async () => {
    const ctx = await setupGroup();
    await readyUp(ctx);
    const suggestions = await suggest(ctx);
    const [top, other, third] = suggestions;
    await emit(ctx.a, 'group:vote', { placeId: other.placeId });
    await emit(ctx.b, 'group:vote', { placeId: top.placeId });
    const result = waitFor(ctx.b, 'group:result');
    expect(await emit(ctx.b, 'group:finish', {})).toMatchObject({ error: { code: 'NOT_CREATOR' } });
    await emit(ctx.a, 'group:finish', { placeId: third.placeId }); // creator override
    expect(await result).toMatchObject({ placeId: third.placeId, decidedBy: 'creator' });
  });

  test('pickWinner: tie broken by score', () => {
    const s = [{ placeId: 1, score: 0.6 }, { placeId: 2, score: 0.9 }];
    expect(pickWinner(s, { a: 1, b: 2 })).toMatchObject({ winner: { placeId: 2 }, decidedBy: 'tie_break' });
    expect(pickWinner(s, { a: 1, b: 1 })).toMatchObject({ winner: { placeId: 1 }, decidedBy: 'votes' });
    expect(pickWinner(s, {})).toMatchObject({ winner: { placeId: 2 } });
  });

  test('voting for a place that was not suggested is rejected', async () => {
    const ctx = await setupGroup();
    await readyUp(ctx);
    await suggest(ctx);
    expect((await emit(ctx.a, 'group:vote', { placeId: 999999 })).error.code).toBe('NOT_A_SUGGESTION');
  });
});

describe('creator handover + reconnect', () => {
  test('creator leaves → next member by join order becomes creator', async () => {
    const ctx = await setupGroup();
    const next = waitFor(ctx.b, 'group:state', (st) => st.creatorId === ctx.memberIds.b);
    await emit(ctx.a, 'group:leave');
    const st = await next;
    expect(st.members.map((m) => m.name)).toEqual(['Bob', 'Chotu']);
  });

  test('creator\'s phone dies → after the grace period the next member takes over', async () => {
    const ctx = await setupGroup();
    const offline = waitFor(ctx.b, 'group:state', (st) => st.members.find((m) => m.name === 'Alice')?.connected === false);
    ctx.a.disconnect();
    await offline;
    const st = await waitFor(ctx.b, 'group:state', (s) => s.creatorId === ctx.memberIds.b, 4000);
    expect(st.creatorId).toBe(ctx.memberIds.b);
  });

  test('reconnect within the grace period → still creator, fresh snapshot', async () => {
    const ctx = await setupGroup();
    await emit(ctx.b, 'group:set_preferences', { mode: 'for_now' });
    ctx.a.disconnect();
    const a2 = await connect(ctx.aliceToken);
    const fresh = waitFor(a2, 'group:state');
    await emit(a2, 'group:join', { code: ctx.code });
    const st = await fresh;
    expect(st).toMatchObject({ creatorId: ctx.memberIds.a, readyCount: 1 });
    expect(st.members.find((m) => m.name === 'Alice').connected).toBe(true);
    await new Promise((r) => setTimeout(r, 1300)); // past the grace period
    expect(a2.latest.creatorId).toBe(ctx.memberIds.a);
  });

  test('only finished groups are saved (abandoned → nothing in Postgres)', async () => {
    const ctx = await setupGroup();
    for (const s of [ctx.a, ctx.b, ctx.g]) await emit(s, 'group:leave');
    expect((await pool.query('SELECT COUNT(*) AS n FROM group_sessions')).rows[0].n).toBe(0);
    expect((await request(app).get(`/api/v1/groups/${ctx.code}`)).status).toBe(404);
  });
});
