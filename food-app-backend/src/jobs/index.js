// Job name → handler. Handlers call services (never controllers), same direction as sockets.
import { JOBS } from '../services/helpers/jobQueue.js';
import stats from './stats.job.js';
import tasteProfile from './tasteProfile.job.js';
import autoTags from './autoTags.job.js';
import trust from './trust.job.js';
import sessionCleanup from './sessionCleanup.job.js';
import { embedDishes, embedReview } from './embedding.job.js';
import summary from './summary.job.js';

export const handlers = {
  [JOBS.REFRESH_STATS]: stats,
  [JOBS.LEARN_TASTE]: tasteProfile,
  [JOBS.AUTO_TAGS]: autoTags,
  [JOBS.TRUST_SCORES]: trust,
  [JOBS.SESSION_CLEANUP]: sessionCleanup,
  [JOBS.EMBED_DISHES]: embedDishes,
  [JOBS.EMBED_REVIEW]: embedReview,
  [JOBS.SUMMARY]: summary,
};

// Repeating jobs (BullMQ job schedulers, Bhubaneswar time)
export const SCHEDULES = [
  { id: 'stats-every-5-min', name: JOBS.REFRESH_STATS, repeat: { every: 5 * 60 * 1000 } },
  { id: 'trust-nightly', name: JOBS.TRUST_SCORES, repeat: { pattern: '30 2 * * *', tz: 'Asia/Kolkata' } },     // 02:30 IST
  { id: 'sessions-nightly', name: JOBS.SESSION_CLEANUP, repeat: { pattern: '0 3 * * *', tz: 'Asia/Kolkata' } }, // 03:00 IST
  { id: 'dish-embeddings-daily', name: JOBS.EMBED_DISHES, repeat: { every: 24 * 60 * 60 * 1000 } },             // also right after start
];

export const runJob = async (name, data) => {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unknown job: ${name}`);
  return handler(data);
};
