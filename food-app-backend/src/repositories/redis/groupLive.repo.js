// groupLiveRepo — live group sessions in Redis: key group:<code>, auto-expiry (group_expiry_hours).
// Every change is read-modify-write under a short per-group lock, so two members acting at the
// same moment never overwrite each other. State lives in Redis, not server memory, so a
// reconnecting phone always gets the current picture.
import crypto from 'node:crypto';
import { redis } from '../../config/redis.js';

const key = (code) => `group:${code}`;
const lockKey = (code) => `lock:group:${code}`;
const LOCK_MS = 3000;

const RELEASE = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

const acquire = async (code) => {
  const token = crypto.randomUUID();
  for (let i = 0; i < 150; i += 1) {
    if (await redis.set(lockKey(code), token, 'PX', LOCK_MS, 'NX')) return token;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`Group ${code} is busy`);
};

// Only if the code is free. Returns false when it already exists.
export const create = async (code, state, ttlSeconds) =>
  (await redis.set(key(code), JSON.stringify(state), 'EX', ttlSeconds, 'NX')) === 'OK';

export const get = async (code) => {
  const raw = await redis.get(key(code));
  return raw ? JSON.parse(raw) : null;
};

export const exists = async (code) => (await redis.exists(key(code))) === 1;

// mutator(state) → { state } to save · { state: null } to delete · { error } to change nothing.
// Anything else returned is passed back as `result`. Expiry is kept (KEEPTTL).
export const update = async (code, mutator) => {
  const token = await acquire(code);
  try {
    const raw = await redis.get(key(code));
    if (!raw) return { error: 'GROUP_NOT_FOUND' };
    const out = await mutator(JSON.parse(raw));
    if (out.error) return out;
    if (out.state === null) await redis.del(key(code));
    else await redis.set(key(code), JSON.stringify(out.state), 'KEEPTTL');
    return out;
  } finally {
    await redis.eval(RELEASE, 1, lockKey(code), token);
  }
};
