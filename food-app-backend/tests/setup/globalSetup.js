// Runs once before the whole suite: rebuild food_app_test from the migrations
// (fresh every run, per 07_testing_plan.md) and empty the test Redis DB.
import 'dotenv/config';
import pg from 'pg';
import { Redis } from 'ioredis';
import { runner } from 'node-pg-migrate';

export default async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const redisUrl = process.env.TEST_REDIS_URL;
  if (!databaseUrl || !redisUrl) throw new Error('TEST_DATABASE_URL and TEST_REDIS_URL must be set');

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    // Safety: never wipe anything but the test DB
    const { rows } = await client.query('SELECT current_database() AS name');
    if (rows[0].name !== 'food_app_test') {
      throw new Error(`Refusing to reset "${rows[0].name}" — tests must use food_app_test`);
    }
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  } finally {
    await client.end();
  }

  await runner({
    databaseUrl,
    dir: 'migrations',
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    log: () => {},
  });

  const redis = new Redis(redisUrl);
  await redis.flushdb();
  await redis.quit();
};
