import pg from 'pg';
import { env } from './env.js';

// BIGINT (int8, OID 20) comes back as text by default ("42") → return numbers.
// Safe: we'll never exceed Number.MAX_SAFE_INTEGER rows. Also makes COUNT(*) a number.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
// Same for BIGINT[] (OID 1016, e.g. array_agg(id)) — otherwise ["1", "5"].
const INT8_ARRAY_OID = 1016;
const parseTextArray = pg.types.getTypeParser(INT8_ARRAY_OID);
pg.types.setTypeParser(INT8_ARRAY_OID, (value) => parseTextArray(value).map((v) => (v === null ? null : Number(v))));

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
});

pool.on('error', (err) => {
  // An idle client errored (e.g. DB restarted) — log it; the pool replaces the client.
  console.error('[db] idle client error:', err.message);
});

// BEGIN → fn(client) → COMMIT; ROLLBACK on any error; always release the client.
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const pingDb = async () => {
  await pool.query('SELECT 1');
};

export const closeDb = async () => {
  await pool.end();
};
