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
