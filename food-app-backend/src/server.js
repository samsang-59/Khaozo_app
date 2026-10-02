import http from 'node:http';
import { env } from './config/env.js';
import { closeDb } from './config/db.js';
import { closeRedis } from './config/redis.js';
import { createApp } from './app.js';

const app = createApp();
const server = http.createServer(app);
// Socket.IO is attached to this same HTTP server in Phase 7 (group mode).

server.listen(env.port, () => {
  console.log(`[server] Khaozo API listening on http://localhost:${env.port}/api/v1`);
});

const shutdown = async (signal) => {
  console.log(`[server] ${signal} received, shutting down`);
  server.close(async () => {
    await Promise.allSettled([closeDb(), closeRedis()]);
    process.exit(0);
  });
  // Force exit if connections don't close in time
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
