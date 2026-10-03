import { jest } from '@jest/globals';
import { EMPTY_FILTERS } from '../../src/ai/schemas/searchFilters.js';

// ---- Mock the AI layer: tests decide what the "AI understood"
let aiFilters = null; // null → AI unavailable
const chat = jest.fn(async () => (aiFilters ? { ok: true, data: { ...EMPTY_FILTERS, ...aiFilters }, provider: 'gemini' } : { ok: false, reason: 'AI_UNAVAILABLE' }));
let embedVector = null;
const embed = jest.fn(async () => embedVector);
jest.unstable_mockModule('../../src/ai/aiAdapter.js', () => ({ chat, embed, isEnabled: () => true, EMBED_DIMENSIONS: 768 }));

const { default: request } = await import('supertest');
const { createApp } = await import('../../src/app.js');
const { pool } = await import('../../src/config/db.js');
const { runSeed } = await import('../../scripts/seed.js');
const ranking = await import('../../src/services/helpers/ranking.js');
const { closeConnections } = await import('../helpers/connections.js');
const { resetData, resetCache, insertUser, insertPlace, insertMenuItem, insertHours, ageUser, lookupId } = await import('../helpers/db.js');
const { accessTokenFor } = await import('../helpers/auth.js');

const app = createApp();
const api = '/api/v1';
const KIIT = { lat: 20.3530, lng: 85.8195 };
const north = (m) => KIIT.lat + m / 111_320;
let p;
let users;

const dishId = async (name) => (await pool.query('SELECT id FROM standard_dishes WHERE name = $1', [name])).rows[0].id;

beforeAll(async () => {
  await resetData();
  await runSeed(); // real areas (KIIT, Patia…) + dish catalog
  const kiitArea = (await pool.query(`SELECT id FROM areas WHERE name = 'KIIT'`)).rows[0].id;
  const mk = (name, m, extra = {}) => insertPlace({ areaId: kiitArea, name, lat: north(m), lng: KIIT.lng, ...extra });
  p = {
    house: await mk('Biryani House', 300),
    hub: await mk('Spice Hub', 1500),
    far: await mk('Far Biryani', 5000),
    vegCafe: await mk('Green Leaf Cafe', 500, { placeType: 'cafe' }),
  };
  await pool.query(`UPDATE places SET diet_type = 'pure_veg' WHERE id = $1`, [p.vegCafe.id]);
  const items = {
    chicken: await insertMenuItem({ placeId: p.house.id, standardDishId: await dishId('Chicken Dum Biryani'), name: 'House Chicken Biryani', price: 220 }),
    mutton: await insertMenuItem({ placeId: p.hub.id, standardDishId: await dishId('Mutton Biryani'), name: 'Mutton Biryani', price: 350 }),
    farVeg: await insertMenuItem({ placeId: p.far.id, standardDishId: await dishId('Veg Biryani'), name: 'Veg Biryani', price: 180 }),
    cafeVeg: await insertMenuItem({ placeId: p.vegCafe.id, standardDishId: await dishId('Veg Biryani'), name: 'Veg Dum Biryani', price: 150 }),
  };
  // Open all day every day at Biryani House; Far Biryani only on Sundays early morning (closed most times)
  await insertHours(p.house.id, [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opensAt: '00:00', closesAt: '23:59' })));
  await insertHours(p.far.id, [{ day: 0, opensAt: '05:00', closesAt: '05:30' }]);

  users = [];
  for (let i = 0; i < 5; i += 1) {
    const u = await insertUser();
    await ageUser(u.id, 60);
    users.push(u);
  }
  const rate = (u, item, stars, spice) =>
    pool.query('INSERT INTO dish_ratings (user_id, menu_item_id, stars, would_order_again, spice) VALUES ($1, $2, $3, true, $4)', [u.id, item.id, stars, spice]);
  for (const [i, u] of users.entries()) {
    await rate(u, items.chicken, i < 3 ? 5 : 4, 'spicy');   // 4.6★
    await rate(u, items.mutton, 4, 'medium');
    await rate(u, items.farVeg, i < 4 ? 5 : 4, 'mild');     // 4.8★
    await rate(u, items.cafeVeg, i < 2 ? 4 : 3, 'mild');    // 3.4★
  }
  const work = (await pool.query(`SELECT id FROM tags WHERE name = 'Work' AND type = 'mood'`)).rows[0].id;
  for (const u of users.slice(0, 3)) {
    await pool.query(`INSERT INTO place_tag_votes (place_id, tag_id, user_id, source) VALUES ($1, $2, $3, 'user')`, [p.vegCafe.id, work, u.id]);
  }
  await ranking.refreshStats();
});
beforeEach(async () => {
  await resetCache();
  aiFilters = null;
  embedVector = null;
  chat.mockClear();
});
afterAll(closeConnections);

const search = (q, query = {}, user = null) => {
  const req = request(app).get(`${api}/search`).query({ q, ...query });
  return user ? req.set('Authorization', `Bearer ${accessTokenFor(user)}`) : req;
};
const names = (res) => res.body.data.items.map((i) => i.place.name);

describe('understand + resolve', () => {
  test('"spicy biryani near KIIT under 250": AI filters, area pin, category, price, relax radius', async () => {
    aiFilters = { dish: 'biryani', spice: 'spicy', maxPrice: 250, area: 'KIIT' };
    const res = await search('spicy biryani near KIIT under 250');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ understoodBy: 'ai', resolved: { dish: 'biryani', area: { name: 'KIIT' } } });
    // Within 3 km only House (₹220) + Green Leaf (₹150) fit under ₹250 → relaxed to 6 km → Far Biryani joins
    expect(res.body.data.relaxed).toEqual(['Nothing within 3 km — showing places within 6 km']);
    expect(names(res).sort()).toEqual(['Biryani House', 'Far Biryani', 'Green Leaf Cafe']);
    expect(names(res)).not.toContain('Spice Hub'); // ₹350
  });

  test('reason is a code template with real numbers', async () => {
    aiFilters = { dish: 'biryani', spice: 'spicy', maxPrice: 250, area: 'KIIT' };
    const res = await search('spicy biryani near KIIT under 250');
    const house = res.body.data.items.find((i) => i.place.name === 'Biryani House');
    expect(house.reason).toMatch(/^Chicken Dum Biryani 4\.6★ \(5\) · Spicy · ₹220 · \d+ m · (Open till|Closes soon)/);
    expect(house.menuItem).toMatchObject({ name: 'House Chicken Biryani', price: 220 });
  });

  test('AI unavailable → keyword parser, same kind of answer', async () => {
    const res = await search('biryani near KIIT under 250');
    expect(res.body.data.understoodBy).toBe('keywords');
    expect(res.body.data.filters).toMatchObject({ dish: 'biryani', area: 'KIIT', maxPrice: 250 });
    expect(names(res)).toContain('Biryani House');
  });

  test('UI-picked filters override the AI guess', async () => {
    aiFilters = { dish: 'biryani', maxPrice: 250, area: 'KIIT' };
    const res = await search('biryani near KIIT under 250', { maxPrice: 400 });
    expect(res.body.data.filters.maxPrice).toBe(400);
    expect(names(res)).toContain('Spice Hub');
  });

  test('vibe → embedding → review similarity boosts the matching place', async () => {
    const cozy = Array(768).fill(0);
    cozy[0] = 1;
    const other = Array(768).fill(0);
    other[1] = 1;
    const add = async (place, vec) => {
      const { rows } = await pool.query(`INSERT INTO place_reviews (user_id, place_id, stars, review_text) VALUES ($1, $2, 4, 'x') RETURNING id`, [users[4].id, place.id]);
      await pool.query('UPDATE place_reviews SET text_embedding = $2::vector WHERE id = $1', [rows[0].id, JSON.stringify(vec)]);
    };
    await add(p.vegCafe, cozy);
    await add(p.house, other);
    aiFilters = { vibe: 'cozy', area: 'KIIT' };
    embedVector = cozy;
    const res = await search('cozy place near KIIT');
    expect(res.body.data.resolved.vibe).toBe('cozy');
    expect(names(res)[0]).toBe('Green Leaf Cafe');
    expect(embed).toHaveBeenCalledWith('cozy', 'RETRIEVAL_QUERY');
    await pool.query('DELETE FROM place_reviews');
  });
});

describe('relax rules', () => {
  test('order: radius → price → open now → mood, one step at a time', async () => {
    aiFilters = { dish: 'biryani', maxPrice: 100, openNow: true, mood: 'Work', area: 'KIIT' };
    const res = await search('cheap biryani open now for work near KIIT');
    expect(res.body.data.relaxed).toEqual([
      'Nothing within 3 km — showing places within 6 km',
      'No match under ₹100, here are options under ₹120',
      'Nothing open right now — showing places that may be closed',
      'No place tagged Work yet — showing other options',
    ]);
  });

  test('stops relaxing once there are 3 results', async () => {
    aiFilters = { dish: 'biryani', area: 'KIIT' };
    const res = await search('biryani near KIIT');
    expect(res.body.data.relaxed).toEqual([]);
    expect(res.body.data.items).toHaveLength(3); // Far Biryani is 5 km away
  });

  test('diet is never relaxed', async () => {
    aiFilters = { dish: 'biryani', diet: 'veg', maxPrice: 100, area: 'KIIT' };
    const res = await search('veg biryani under 100 near KIIT');
    expect(res.body.data.relaxed.length).toBeGreaterThan(0);
    for (const item of res.body.data.items) expect(item.menuItem.diet).toBe('veg');
    expect(names(res)).not.toContain('Biryani House');
  });

  test('mood tag filters places', async () => {
    aiFilters = { mood: 'Work', area: 'KIIT' };
    const res = await search('place to work near KIIT');
    expect(names(res)[0]).toBe('Green Leaf Cafe');
    expect(res.body.data.items[0].reason).toContain('Good for Work');
  });
});

describe('personalisation', () => {
  let spiceLover;
  let mildEater;
  beforeAll(async () => {
    spiceLover = await insertUser({ name: 'Spice Lover' });
    mildEater = await insertUser({ name: 'Mild Eater' });
    const chicken = await lookupId('main_ingredients', 'Chicken');
    await pool.query('INSERT INTO taste_profiles (user_id, spice_quiz, quiz_done) VALUES ($1, 3, true), ($2, 1, true)', [spiceLover.id, mildEater.id]);
    await pool.query('INSERT INTO taste_profile_avoid (user_id, main_ingredient_id) VALUES ($1, $2)', [mildEater.id, chicken]);
  });

  test('cache never leaks another user\'s Match % (cached part is non-personal)', async () => {
    aiFilters = { dish: 'biryani', area: 'KIIT' };
    const a = await search('biryani near KIIT', {}, spiceLover);
    const b = await search('biryani near KIIT', {}, mildEater);
    const guest = await search('biryani near KIIT');
    expect(a.body.data.cached).toBe(false);
    expect(b.body.data.cached).toBe(true);
    expect(guest.body.data.cached).toBe(true);
    const pct = (res, name) => res.body.data.items.find((i) => i.place.name === name)?.matchPct;
    expect(pct(a, 'Biryani House')).toBe(100);           // spicy dish, spice-lover
    expect(pct(b, 'Green Leaf Cafe')).toBe(100);         // mild dish, mild eater
    expect(pct(a, 'Green Leaf Cafe')).toBeLessThan(100);
    expect(guest.body.data.items.every((i) => i.matchPct === null)).toBe(true);
    expect(chat).toHaveBeenCalledTimes(1); // AI asked once, then cached
  });

  test('foods to avoid applied automatically, "Show all" turns it off', async () => {
    aiFilters = { dish: 'biryani', area: 'KIIT' };
    const filtered = await search('biryani near KIIT', {}, mildEater);
    expect(names(filtered)).not.toContain('Biryani House'); // chicken
    expect(filtered.body.data.personalised).toMatchObject({ applied: true, hiddenByDiet: 1, showAll: false });
    const all = await search('biryani near KIIT', { showAll: 'true' }, mildEater);
    expect(names(all)).toContain('Biryani House');
  });
});

describe('cache', () => {
  test('500 m grid: nearby points share the cache, far points do not', async () => {
    aiFilters = { dish: 'biryani' };
    const at = (m) => ({ lat: north(m), lng: KIIT.lng });
    expect((await search('biryani', at(0))).body.data.cached).toBe(false);
    expect((await search('biryani', at(100))).body.data.cached).toBe(true);
    expect((await search('biryani', at(2000))).body.data.cached).toBe(false);
  });

  test('distances are re-measured from the user\'s own point', async () => {
    aiFilters = { dish: 'biryani' };
    const a = await search('biryani', { lat: north(0), lng: KIIT.lng });
    const b = await search('biryani', { lat: north(150), lng: KIIT.lng });
    const d = (res) => res.body.data.items.find((i) => i.place.name === 'Biryani House').distanceM;
    expect(d(a)).toBe(300);
    expect(d(b)).toBe(150);
  });
});

describe('card photos', () => {
  afterAll(() => pool.query('DELETE FROM photos'));

  test("a dish result shows that dish's newest rating photo; a place result its gallery photo; else null", async () => {
    const ratingOf = async (placeId) => (await pool.query(
      'SELECT r.id FROM dish_ratings r JOIN menu_items m ON m.id = r.menu_item_id WHERE m.place_id = $1 ORDER BY r.id LIMIT 1', [placeId])).rows[0].id;
    const addPhoto = (url, ratingId) => pool.query(`INSERT INTO photos (url, cloudinary_public_id, dish_rating_id) VALUES ($1, 'x', $2)`, [url, ratingId]);
    await addPhoto('https://img/house-old.jpg', await ratingOf(p.house.id));
    await addPhoto('https://img/house-new.jpg', await ratingOf(p.house.id));
    await addPhoto('https://img/cafe.jpg', await ratingOf(p.vegCafe.id));

    aiFilters = { dish: 'biryani', area: 'KIIT' };
    const dish = await search('biryani near KIIT');
    const photo = (res, name) => res.body.data.items.find((i) => i.place.name === name).photoUrl;
    expect(photo(dish, 'Biryani House')).toBe('https://img/house-new.jpg');
    expect(photo(dish, 'Spice Hub')).toBeNull();

    aiFilters = { mood: 'Work', area: 'KIIT' };
    const place = await search('place to work near KIIT');
    expect(photo(place, 'Green Leaf Cafe')).toBe('https://img/cafe.jpg');
  });
});

describe('fallback: dish known, but no menu has it nearby yet', () => {
  let extra;
  beforeAll(async () => {
    const kiitArea = (await pool.query(`SELECT id FROM areas WHERE name = 'KIIT'`)).rows[0].id;
    const mk = (name, m) => insertPlace({ areaId: kiitArea, name, lat: north(m), lng: KIIT.lng });
    extra = {
      momoPoint: await mk('Momo Point', 800),
      wok: await mk('Dragon Wok', 200),
      vegMomo: await mk('Pure Veg Momos', 400),
      farMomo: await mk('Far Momos', 9000),
    };
    await pool.query(`UPDATE places SET diet_type = 'pure_veg' WHERE id = $1`, [extra.vegMomo.id]);
    await pool.query('INSERT INTO place_cuisines (place_id, cuisine_id) VALUES ($1, $2)', [extra.wok.id, await lookupId('cuisines', 'Chinese')]);
  });
  afterAll(async () => {
    const ids = Object.values(extra).map((x) => x.id);
    await pool.query('DELETE FROM place_cuisines WHERE place_id = ANY($1::bigint[])', [ids]);
    await pool.query('DELETE FROM places WHERE id = ANY($1::bigint[])', [ids]);
  });

  test('suggests places that probably serve it: name match first, then cuisine; with a note', async () => {
    aiFilters = { dish: 'momos', area: 'KIIT' };
    const res = await search('momos near KIIT');
    // name matches (nearest first), then the cuisine match; Far Momos is 9 km away
    expect(names(res)).toEqual(['Pure Veg Momos', 'Momo Point', 'Dragon Wok']);
    expect(res.body.data.items.every((i) => i.likelyServes && i.menuItem === null)).toBe(true);
    expect(res.body.data.items[0].reason).toMatch(/^Probably serves momos/);
    expect(res.body.data.relaxed).toContain('No one has added momos at places near here yet — these places probably serve it');
  });

  test('a non-veg dish never suggests a pure-veg place', async () => {
    aiFilters = { dish: 'chicken momos', area: 'KIIT' };
    const res = await search('chicken momos near KIIT');
    expect(names(res)).toContain('Momo Point');
    expect(names(res)).not.toContain('Pure Veg Momos');
  });

  test('not used when the dish is on a menu nearby but other filters rule it out', async () => {
    aiFilters = { dish: 'biryani', maxPrice: 50, area: 'KIIT' };
    const res = await search('biryani under 50 near KIIT');
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.relaxed.some((n) => n.startsWith('No one has added'))).toBe(false);
  });

  test('never used when a real menu match exists', async () => {
    aiFilters = { dish: 'biryani', area: 'KIIT' };
    const res = await search('biryani near KIIT');
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items.every((i) => i.likelyServes === false && i.menuItem)).toBe(true);
  });
});

test('validation: q required; lat needs lng', async () => {
  expect((await request(app).get(`${api}/search`)).status).toBe(400);
  expect((await search('biryani', { lat: 20.3 })).status).toBe(400);
});
