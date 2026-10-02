import http from 'node:http';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { closeDb } from './config/db.js';
import { closeRedis } from './config/redis.js';
import { close as closeQueue } from './services/helpers/jobQueue.js';
import { createApp } from './app.js';
import { attachGroupSockets } from './sockets/group.socket.js';

const app = createApp();
const server = http.createServer(app);

// Socket.IO on the same HTTP server (group mode only). The frontend reaches it through the
// Vite dev proxy (/socket.io) in development and the same origin in production.
const io = new Server(server);
const groupSockets = attachGroupSockets(io);

server.listen(env.port, () => {
  console.log(`[server] Khaozo API listening on http://localhost:${env.port}/api/v1 (+ Socket.IO)`);
});

const shutdown = async (signal) => {
  console.log(`[server] ${signal} received, shutting down`);
  groupSockets.close();
  io.close();
  server.close(async () => {
    await Promise.allSettled([closeDb(), closeRedis(), closeQueue()]);
    process.exit(0);
  });
  // Force exit if connections don't close in time
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
