// cacheRepo — the only place that touches Redis for caching and rate-limit counters.
// Plain data in, plain data out. Services never use the Redis client directly.
import { redis } from '../../config/redis.js';

export const getJson = async (key) => {
  const raw = await redis.get(key);
  return raw === null ? null : JSON.parse(raw);
};

export const setJson = async (key, value, ttlSeconds) => {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
};

export const del = async (...keys) => {
  if (keys.length === 0) return 0;
  return redis.del(...keys);
};

// Deletes every key starting with prefix (e.g. 'meta:' when admin edits lookup lists).
// SCAN instead of KEYS so Redis is never blocked.
export const delByPrefix = async (prefix) => {
  let cursor = '0';
  let deleted = 0;
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) deleted += await redis.del(...keys);
  } while (cursor !== '0');
  return deleted;
};

// Fixed-window counter for rate limits: count requests in the current window.
// The expiry is set only when the window starts (NX), so it is never extended.
export const incrementWindow = async (key, windowSeconds) => {
  const [[incrErr, count], [expErr], [ttlErr, ttl]] = await redis
    .multi()
    .incr(key)
    .expire(key, windowSeconds, 'NX')
    .ttl(key)
    .exec();
  if (incrErr || expErr || ttlErr) throw incrErr || expErr || ttlErr;
  return { count, ttlSeconds: ttl };
};
