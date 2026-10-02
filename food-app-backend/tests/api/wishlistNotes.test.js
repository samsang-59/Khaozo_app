import request from 'supertest';
import { createApp } from '../../src/app.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, resetCache } from '../helpers/db.js';
import { world, bearer } from '../helpers/fixtures.js';

const app = createApp();
const api = '/api/v1';
let w;

beforeEach(async () => {
  await resetData();
  await resetCache();
  w = await world();
});
afterAll(closeConnections);

describe('wishlist', () => {
  const add = (body, user = w.user) => request(app).post(`${api}/me/wishlist`).set(bearer(user)).send(body);

  test('save a place, a menu item and a standard dish; list shows each kind', async () => {
    expect((await add({ placeId: w.place.id })).status).toBe(201);
    expect((await add({ menuItemId: w.biryaniItem.id })).status).toBe(201);
    expect((await add({ standardDishId: w.dalma.id })).status).toBe(201);
    const res = await request(app).get(`${api}/me/wishlist`).set(bearer(w.user));
    expect(res.body.data.map((i) => i.target.kind).sort()).toEqual(['dish', 'menu_item', 'place']);
    expect(res.body.data.find((i) => i.target.kind === 'menu_item').target.place.name).toBe('Dalma Restaurant');
  });

  test('exactly one target; no duplicate saves', async () => {
    expect((await add({})).status).toBe(400);
    expect((await add({ placeId: w.place.id, menuItemId: w.biryaniItem.id })).status).toBe(400);
    await add({ placeId: w.place.id });
    expect((await add({ placeId: w.place.id })).body.error.code).toBe('ALREADY_IN_WISHLIST');
  });

  test('rating a wishlisted dish marks it Tried ✅ and it stays in the list', async () => {
    await add({ menuItemId: w.biryaniItem.id });
    await request(app).post(`${api}/menu-items/${w.biryaniItem.id}/ratings`).set(bearer(w.user)).send({ stars: 5, wouldOrderAgain: true });
    const res = await request(app).get(`${api}/me/wishlist`).set(bearer(w.user));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].triedAt).not.toBeNull();
  });

  test('delete only your own items', async () => {
    const { body } = await add({ placeId: w.place.id });
    expect((await request(app).delete(`${api}/me/wishlist/${body.data.id}`).set(bearer(w.other))).status).toBe(404);
    expect((await request(app).delete(`${api}/me/wishlist/${body.data.id}`).set(bearer(w.user))).status).toBe(200);
  });
});

describe('private notes', () => {
  const create = (body, user = w.user) => request(app).post(`${api}/me/notes`).set(bearer(user)).send(body);

  test('CRUD on your own notes', async () => {
    const { body } = await create({ placeId: w.place.id, text: 'Ask for less oil' });
    expect(body.data).toMatchObject({ text: 'Ask for less oil', placeId: w.place.id });
    const edit = await request(app).patch(`${api}/me/notes/${body.data.id}`).set(bearer(w.user)).send({ text: 'Less oil, extra onion' });
    expect(edit.body.data.text).toBe('Less oil, extra onion');
    const list = await request(app).get(`${api}/me/notes`).set(bearer(w.user));
    expect(list.body.data).toEqual([expect.objectContaining({ placeName: 'Dalma Restaurant', text: 'Less oil, extra onion' })]);
    expect((await request(app).delete(`${api}/me/notes/${body.data.id}`).set(bearer(w.user))).status).toBe(200);
  });

  test('only the owner can ever see / edit / delete a note', async () => {
    const { body } = await create({ menuItemId: w.biryaniItem.id, text: 'Secret' });
    expect((await request(app).get(`${api}/me/notes`).set(bearer(w.other))).body.data).toEqual([]);
    expect((await request(app).patch(`${api}/me/notes/${body.data.id}`).set(bearer(w.other)).send({ text: 'x' })).status).toBe(404);
    expect((await request(app).delete(`${api}/me/notes/${body.data.id}`).set(bearer(w.other))).status).toBe(404);
  });

  test('exactly one target and text ≤ 2000 chars', async () => {
    expect((await create({ text: 'x' })).status).toBe(400);
    expect((await create({ placeId: w.place.id, text: 'x'.repeat(2001) })).status).toBe(400);
  });
});
