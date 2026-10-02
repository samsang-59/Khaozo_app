// jobQueue (helper) — services put background jobs into one BullMQ queue (Redis).
// worker.js (a separate process) picks them up and calls services.
// Always call add() AFTER the database transaction has committed.
import { Queue } from 'bullmq';
import { env } from '../../config/env.js';

export const QUEUE_NAME = 'khaozo';

export const JOBS = Object.freeze({
  REFRESH_STATS: 'stats.refresh',
  LEARN_TASTE: 'taste.learn',
  AUTO_TAGS: 'tags.auto',
  TRUST_SCORES: 'trust.recalculate',
  SESSION_CLEANUP: 'sessions.cleanup',
  EMBED_DISHES: 'dishes.embed',
  EMBED_REVIEW: 'review.embed',
  SUMMARY: 'summary.refresh',
  DELETE_PHOTOS: 'photos.delete',
});

// BullMQ needs its own connection settings (maxRetriesPerRequest: null).
export const connection = () => {
  const url = new URL(env.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname.slice(1) || 0),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    maxRetriesPerRequest: null,
  };
};

let queue = null;
export const getQueue = () => {
  queue ??= new Queue(QUEUE_NAME, {
    connection: connection(),
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 },
  });
  return queue;
};

// A queue problem must never fail the user's request (their data is already saved):
// log it — periodic jobs (stats refresh, trust) catch up anyway.
export const add = async (name, data = {}, opts = {}) => {
  try {
    await getQueue().add(name, data, opts);
    return true;
  } catch (err) {
    console.error(`[jobQueue] could not queue ${name}:`, err.message);
    return false;
  }
};

export const close = async () => {
  if (queue) await queue.close();
  queue = null;
};
