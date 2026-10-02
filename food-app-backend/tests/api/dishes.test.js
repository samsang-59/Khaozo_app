import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { runSeed } from '../../scripts/seed.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData, resetCache, insertUser, insertArea, insertPlace, lookupId } from '../helpers/db.js';
import { accessTokenFor } from '../helpers/auth.js';

const app = createApp();
const api = '/api/v1';
let user;
let place;

beforeAll(async () => {
  await resetData();
  await runSeed(); // real catalog: 175 dishes + aliases
});
beforeEach(async () => {
  await resetCache();
  await pool.query('DELETE FROM menu_items');
  await pool.query(`DELETE FROM standard_dishes WHERE status = 'pending_review'`);
  await pool.query('DELETE FROM users');
  user = await insertUser();
  const area = (await pool.query(`SELECT id FROM areas WHERE name = 'Patia'`)).rows[0] ?? (await insertArea({ name: 'Patia' }));
  place = await insertPlace({ areaId: area.id, name: 'Tarini', lat: 20.3605, lng: 85.8248 });
});
afterAll(closeConnections);

const auth = () => ({ Authorization: `Bearer ${accessTokenFor(user)}` });
const match = (q) => request(app).get(`${api}/dishes/match`).query({ q });

describe('GET /dishes/match (dishMatcher: alias → pg_trgm)', () => {
  test('alias → exact', async () => {
    const res = await match('chkn biryani');
    expect(res.body.data).toMatchObject({ level: 'exact', match: { name: 'Chicken Dum Biryani', diet: 'non_veg', category: 'Biryani' } });
  });

  test('dish name in any case → exact', async () => {
    expect((await match('DALMA')).body.data.match.name).toBe('Dalma');
  });

  test('misspelling → similar candidates, best first', async () => {
    const res = await match('chiken dum biriyani');
    expect(res.body.data.level).toBe('similar');
    expect(res.body.data.candidates[0].name).toBe('Chicken Dum Biryani');
    expect(res.body.data.candidates[0].score).toBeGreaterThan(0.3);
  });

  test('nothing close → none', async () => {
    expect((await match('qwxz zzyq')).body.data).toEqual({ level: 'none', match: null, candidates: [] });
  });

  test('q too short → 400', async () => {
    expect((await match('a')).status).toBe(400);
  });
});

describe('POST /places/:id/menu-items', () => {
  const add = (body) => request(app).post(`${api}/places/${place.id}/menu-items`).set(auth()).send(body);

  test('exact match auto-links the standard dish', async () => {
    const res = await add({ name: 'Rasgulla', price: 20 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Rasgulla', price: 20, standardDish: { name: 'Rasagola', status: 'active' } });
  });

  test('similar → 409 "Is this X?"; confirming adds the spelling as an alias', async () => {
    const asked = await add({ name: 'Chiken Dum Biriyani' });
    expect(asked.status).toBe(409);
    expect(asked.body.error.code).toBe('DISH_NEEDS_CONFIRMATION');
    const target = asked.body.error.details.candidates[0];
    expect(target.name).toBe('Chicken Dum Biryani');

    const confirmed = await add({ name: 'Chiken Dum Biriyani', standardDishId: target.id, price: 220 });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.data.standardDish.name).toBe('Chicken Dum Biryani');
    expect((await match('chiken dum biriyani')).body.data.level).toBe('exact'); // learned alias
  });

  test('no match → needs details → new standard dish pending admin review', async () => {
    expect((await add({ name: 'Qwxz Special' })).body.error.code).toBe('DISH_DETAILS_REQUIRED');
    const res = await add({
      name: 'Qwxz Special',
      newDish: { categoryId: await lookupId('dish_categories', 'Curry'), cuisineId: await lookupId('cuisines', 'Odia'), diet: 'veg' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.standardDish).toMatchObject({ name: 'Qwxz Special', status: 'pending_review' });
  });

  test('diet must fit the main ingredient (no Chicken + veg)', async () => {
    const res = await add({
      name: 'Qwxz Chicken',
      newDish: {
        categoryId: await lookupId('dish_categories', 'Curry'),
        cuisineId: await lookupId('cuisines', 'Odia'),
        mainIngredientId: await lookupId('main_ingredients', 'Chicken'),
        diet: 'veg',
      },
    });
    expect(res.body.error.code).toBe('DIET_INGREDIENT_MISMATCH');
  });

  test('same item twice on a menu → 409', async () => {
    await add({ name: 'Rasgulla' });
    const res = await add({ name: 'rasgulla' });
    expect(res.body.error.code).toBe('MENU_ITEM_EXISTS');
  });

  test('closed place → 409; needs login → 401', async () => {
    await pool.query(`UPDATE places SET status = 'closed' WHERE id = $1`, [place.id]);
    expect((await add({ name: 'Rasgulla' })).body.error.code).toBe('PLACE_CLOSED');
    expect((await request(app).post(`${api}/places/${place.id}/menu-items`).send({ name: 'Rasgulla' })).status).toBe(401);
  });
});
