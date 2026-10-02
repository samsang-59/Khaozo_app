import { pool, withTransaction } from '../../src/config/db.js';
import { closeConnections } from '../helpers/connections.js';

afterAll(closeConnections);

describe('db.js', () => {
  test('connects to the test database', async () => {
    const { rows } = await pool.query('SELECT current_database() AS name');
    expect(rows[0].name).toBe('food_app_test');
  });

  test('custom image provides postgis, vector and pg_trgm', async () => {
    const { rows } = await pool.query(
      `SELECT name FROM pg_available_extensions WHERE name IN ('postgis', 'vector', 'pg_trgm') ORDER BY name`,
    );
    expect(rows.map((r) => r.name)).toEqual(['pg_trgm', 'postgis', 'vector']);
  });

  test('BIGINT comes back as a number, not text', async () => {
    const { rows } = await pool.query('SELECT 42::bigint AS id, COUNT(*) AS n FROM (VALUES (1), (2)) v(x)');
    expect(rows[0].id).toBe(42);
    expect(rows[0].n).toBe(2);
  });

  describe('withTransaction', () => {
    beforeAll(async () => {
      await pool.query('CREATE TABLE IF NOT EXISTS _tx_test (id BIGINT PRIMARY KEY)');
    });
    beforeEach(async () => {
      await pool.query('TRUNCATE _tx_test');
    });
    afterAll(async () => {
      await pool.query('DROP TABLE IF EXISTS _tx_test');
    });

    test('commits when fn succeeds and returns its value', async () => {
      const value = await withTransaction(async (client) => {
        await client.query('INSERT INTO _tx_test (id) VALUES (1), (2)');
        return 'done';
      });
      expect(value).toBe('done');
      const { rows } = await pool.query('SELECT COUNT(*) AS n FROM _tx_test');
      expect(rows[0].n).toBe(2);
    });

    test('rolls back everything when the second write fails', async () => {
      await expect(
        withTransaction(async (client) => {
          await client.query('INSERT INTO _tx_test (id) VALUES (1)');
          await client.query('INSERT INTO _tx_test (id) VALUES (1)'); // duplicate PK
        }),
      ).rejects.toThrow();
      const { rows } = await pool.query('SELECT COUNT(*) AS n FROM _tx_test');
      expect(rows[0].n).toBe(0);
    });

    test('releases the client back to the pool', async () => {
      await withTransaction(async () => {});
      await expect(withTransaction(async () => { throw new Error('x'); })).rejects.toThrow('x');
      expect(pool.totalCount - pool.idleCount).toBe(0);
    });
  });
});
