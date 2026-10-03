// Socket.IO for group mode only. auth is a FUNCTION so every (re)connect reads the current
// token — after a 15-min access-token refresh, a reconnect uses the new one.
import { io } from 'socket.io-client';
import { getAccessToken, refreshSession } from '@/api/client.js';

// tokenFor(): guest pass for this group, else the signed-in user's access token
export const createGroupSocket = (tokenFor) =>
  io(import.meta.env.VITE_API_URL || undefined, {
    path: '/socket.io',
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    auth: (cb) => cb({ token: tokenFor() }),
  });

// Promise wrapper around emit + ack ({ ok, error })
export const emitAck = (socket, event, payload, timeoutMs = 10000) =>
  new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(event, payload ?? {}, (err, res) => {
      if (err) resolve({ ok: false, error: { code: 'TIMEOUT', message: 'No answer from the group. Check your connection.' } });
      else resolve(res ?? { ok: true });
    });
  });

export { getAccessToken, refreshSession };
