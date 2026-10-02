import { pool } from '../../src/config/db.js';
import { runSeed } from '../../scripts/seed.js';
import { closeConnections } from '../helpers/connections.js';
import { resetData } from '../helpers/db.js';

beforeAll(resetData);
afterAll(closeConnections);

const counts = async () => {
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM areas) AS areas,
            (SELECT COUNT(DISTINCT name) FROM areas) AS distinct_areas,
            (SELECT COUNT(*) FROM standard_dishes) AS dishes,
            (SELECT COUNT(*) FROM dish_aliases) AS aliases`,
  );
  return rows[0];
};

describe('seeds/seed.sql', () => {
  test('loads Bhubaneswar area pins', async () => {
    await runSeed();
    const c = await counts();
    expect(c.areas).toBeGreaterThan(50);
    expect(c.distinctAreas ?? c.distinct_areas).toBe(c.areas);
  });

  test('loads the reviewed dish catalog (175 dishes, 164 aliases)', async () => {
    const c = await counts();
    expect(c.dishes).toBe(175);
    expect(c.aliases).toBe(164);
  });

  test('catalog spot checks: links, diet, no main ingredient where none', async () => {
    const { rows } = await pool.query(
      `SELECT d.name, c.name AS category, cu.name AS cuisine, mi.name AS ingredient, d.diet, d.status
       FROM standard_dishes d
       JOIN dish_categories c ON c.id = d.category_id
       JOIN cuisines cu ON cu.id = d.cuisine_id
       LEFT JOIN main_ingredients mi ON mi.id = d.main_ingredient_id
       WHERE d.name IN ('Chicken Dum Biryani', 'Dalma', 'Rasagola', 'Margherita Pizza', 'Masala Chai')
       ORDER BY d.name`,
    );
    expect(rows).toEqual([
      { name: 'Chicken Dum Biryani', category: 'Biryani', cuisine: 'Mughlai', ingredient: 'Chicken', diet: 'non_veg', status: 'active' },
      { name: 'Dalma', category: 'Veg curry', cuisine: 'Odia', ingredient: null, diet: 'veg', status: 'active' },
      { name: 'Margherita Pizza', category: 'Pizza', cuisine: 'Fast food', ingredient: null, diet: 'veg', status: 'active' },
      { name: 'Masala Chai', category: 'Drinks', cuisine: 'Beverages', ingredient: null, diet: 'veg', status: 'active' },
      { name: 'Rasagola', category: 'Chhena sweets', cuisine: 'Odia', ingredient: 'Chhena', diet: 'veg', status: 'active' },
    ]);
    const alias = await pool.query(`SELECT d.name FROM dish_aliases a JOIN standard_dishes d ON d.id = a.standard_dish_id WHERE a.alias = 'rasgulla'`);
    expect(alias.rows).toEqual([{ name: 'Rasagola' }]);
  });

  test('no veg / egg dish has a meat or fish main ingredient', async () => {
    const { rows } = await pool.query(
      `SELECT d.name FROM standard_dishes d JOIN main_ingredients mi ON mi.id = d.main_ingredient_id
       WHERE (d.diet = 'veg' AND mi.name IN ('Chicken', 'Mutton', 'Fish', 'Prawn', 'Crab', 'Egg'))
          OR (d.diet = 'egg' AND mi.name IN ('Chicken', 'Mutton', 'Fish', 'Prawn', 'Crab'))`,
    );
    expect(rows).toEqual([]);
  });

  test('running it twice creates no duplicates', async () => {
    const before = await counts();
    await runSeed();
    expect(await counts()).toEqual(before);
  });

  test('every area pin lies inside the Bhubaneswar bounding box', async () => {
    const { rows } = await pool.query(
      `SELECT name FROM areas
       WHERE NOT ST_Intersects(location, ST_MakeEnvelope(85.70, 20.18, 85.95, 20.40, 4326)::geography)`,
    );
    expect(rows).toEqual([]);
  });
});
