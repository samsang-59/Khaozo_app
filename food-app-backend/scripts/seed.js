// npm run seed — runs seeds/seed.sql against DATABASE_URL. Safe to run twice.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { pool, closeDb } from '../src/config/db.js';

const SEED_FILE = new URL('../seeds/seed.sql', import.meta.url);

export const runSeed = async (db = pool) => {
  const sql = await readFile(SEED_FILE, 'utf8');
  await db.query(sql); // seed.sql has its own BEGIN / COMMIT
};

// Run directly (not when imported by tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runSeed();
    const { rows } = await pool.query('SELECT COUNT(*) AS areas FROM areas');
    console.log(`[seed] done — areas: ${rows[0].areas}`);
  } finally {
    await closeDb();
  }
}
