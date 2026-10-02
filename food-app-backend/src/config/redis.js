import { Redis } from 'ioredis';
import { env } from './env.js';

// One shared ioredis client. BullMQ (Phase 5) creates its own connections
// from the same URL because its workers need maxRetriesPerRequest: null.
export const redis = new Redis(env.redisUrl, {
  lazyConnect: false,
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  // Connection-refused errors have an empty message — fall back to the code
  console.error('[redis] error:', err.message || err.code);
});

export const pingRedis = async () => {
  const reply = await redis.ping();
  if (reply !== 'PONG') throw new Error(`Unexpected PING reply: ${reply}`);
};

export const closeRedis = async () => {
  await redis.quit();
};
