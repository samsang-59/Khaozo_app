// Background worker — a separate process (npm run worker), so slow jobs never slow API responses.
import { Worker } from 'bullmq';
import { closeDb } from './config/db.js';
import { closeRedis } from './config/redis.js';
import * as jobQueue from './services/helpers/jobQueue.js';
import { runJob, SCHEDULES } from './jobs/index.js';

// Register / update the repeating jobs (idempotent: upsert by scheduler id)
const queue = jobQueue.getQueue();
for (const s of SCHEDULES) {
  await queue.upsertJobScheduler(s.id, s.repeat, { name: s.name, data: {} });
}

const worker = new Worker(jobQueue.QUEUE_NAME, (job) => runJob(job.name, job.data), {
  connection: jobQueue.connection(),
  concurrency: 4,
});

worker.on('completed', (job, result) => console.log(`[worker] ${job.name} done`, result ?? ''));
worker.on('failed', (job, err) => console.error(`[worker] ${job?.name} failed (attempt ${job?.attemptsMade}):`, err.message));

console.log(`[worker] listening on queue "${jobQueue.QUEUE_NAME}" — schedules: ${SCHEDULES.map((s) => s.id).join(', ')}`);

const shutdown = async (signal) => {
  console.log(`[worker] ${signal} received, shutting down`);
  await worker.close();
  await jobQueue.close();
  await Promise.allSettled([closeDb(), closeRedis()]);
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
