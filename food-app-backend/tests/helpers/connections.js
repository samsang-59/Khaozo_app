// Each Jest test file gets its own module registry, so every file that
// touches the DB or Redis must close its connections in afterAll.
import { closeDb } from '../../src/config/db.js';
import { closeRedis } from '../../src/config/redis.js';

export const closeConnections = async () => {
  await Promise.allSettled([closeDb(), closeRedis()]);
};
