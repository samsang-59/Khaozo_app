// Socket.IO — group mode only (everything else is HTTP). Room per group: group:<code>.
// Each person connects with their own token (io(url, { auth: { token } })): an access token
// or a guest pass, which only works for its own group. After ANY change every phone gets a
// full snapshot (group:state), so a missed message never leaves a phone out of sync; a
// reconnecting phone re-joins and gets a fresh snapshot (state lives in Redis).
import { verifyAccessToken, verifyGuestPass } from '../services/auth.service.js';
import * as groupService from '../services/group.service.js';
import * as configService from '../services/helpers/config.js';
import * as v from '../validators/groups.validators.js';
import { getReason } from '../utils/reasons.js';

const room = (code) => `group:${code}`;
const errorPayload = (code, details) => ({ code, message: getReason(code).message, ...(details ? { details } : {}) });

// Connection auth: io.use() accepts access tokens or guest passes
const authenticate = (socket, next) => {
  const token = socket.handshake.auth?.token;
  const user = token && verifyAccessToken(token);
  if (user) {
    socket.data.identity = { kind: 'user', userId: user.id };
    return next();
  }
  const guest = token && verifyGuestPass(token);
  if (guest) {
    socket.data.identity = { kind: 'guest', guestId: guest.guestId, groupCode: guest.groupCode };
    return next();
  }
  const err = new Error('UNAUTHORIZED');
  err.data = errorPayload('UNAUTHORIZED');
  return next(err);
};

// Socket events: max N per second per connection (config rate_limits.socket.conn).
// Limits load lazily so handlers can be registered synchronously on connect
// (an event sent right after connecting must never be missed).
const eventLimiter = (enabled) => {
  let rules = null;
  let windowStart = Date.now();
  let count = 0;
  return async () => {
    if (!enabled) return true;
    rules ??= (await configService.get('rate_limits')).socket?.conn ?? [Infinity, 1];
    const [max, windowSeconds] = rules;
    const now = Date.now();
    if (now - windowStart >= windowSeconds * 1000) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= max;
  };
};

// options: { rateLimits = true }
export const attachGroupSockets = (io, { rateLimits = true } = {}) => {
  const graceTimers = new Map(); // memberKey → timeout (creator offline)

  io.use(authenticate);

  const broadcast = (group) => {
    if (group) io.to(room(group.code)).emit('group:state', group);
  };

  io.on('connection', (socket) => {
    const allowed = eventLimiter(rateLimits);

    // Wraps every event: rate limit, payload validation, membership, errors → group:error + ack
    const on = (event, schema, handler, { needsGroup = true } = {}) => {
      socket.on(event, async (payload, ack) => {
        if (typeof payload === 'function') [payload, ack] = [undefined, payload];
        const reply = (body) => (typeof ack === 'function' ? ack(body) : undefined);
        const failWith = (code, details) => {
          const error = errorPayload(code, details);
          socket.emit('group:error', error);
          reply({ ok: false, error });
        };
        if (!(await allowed())) return failWith('RATE_LIMITED');
        let data = payload;
        if (schema) {
          const parsed = schema.safeParse(payload ?? {});
          if (!parsed.success) return failWith('VALIDATION_ERROR', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
          data = parsed.data;
        }
        if (needsGroup && !socket.data.code) return failWith('NOT_A_MEMBER');
        try {
          const result = await handler(data);
          if (!result.ok) return failWith(result.reason, result.details);
          reply({ ok: true });
        } catch (err) {
          console.error(`[socket] ${event} failed`, err);
          failWith('INTERNAL_ERROR');
        }
      });
    };

    const ctx = () => ({ code: socket.data.code, memberId: socket.data.memberId });

    on('group:join', v.socketJoin, async ({ code }) => {
      const result = await groupService.connect(code, socket.data.identity);
      if (!result.ok) return result;
      if (socket.data.code && socket.data.code !== code) socket.leave(room(socket.data.code));
      socket.data.code = code;
      socket.data.memberId = result.data.memberId;
      socket.join(room(code));
      const timer = graceTimers.get(`${code}:${result.data.memberId}`);
      if (timer) clearTimeout(timer);
      broadcast(result.data.group);
      return result;
    }, { needsGroup: false });

    on('group:set_preferences', v.socketPreferences, async (prefs) => {
      const result = await groupService.setPreferences(ctx().code, ctx().memberId, prefs);
      if (result.ok) broadcast(result.data);
      return result;
    });

    on('group:set_location', v.socketLocation, async (location) => {
      const result = await groupService.setLocation(ctx().code, ctx().memberId, location);
      if (result.ok) broadcast(result.data);
      return result;
    });

    on('group:start_suggestions', null, async () => {
      const result = await groupService.startSuggestions(ctx().code, ctx().memberId);
      if (result.ok) {
        io.to(room(ctx().code)).emit('group:suggestions', result.data.suggestions);
        broadcast(result.data);
      }
      return result;
    });

    const afterVoteOrFinish = (result) => {
      if (!result.ok) return;
      broadcast(result.data.group);
      if (result.data.finished) io.to(room(ctx().code)).emit('group:result', result.data.group.result);
    };

    on('group:vote', v.socketVote, async ({ placeId }) => {
      const result = await groupService.vote(ctx().code, ctx().memberId, placeId);
      afterVoteOrFinish(result);
      return result;
    });

    on('group:finish', v.socketFinish, async ({ placeId }) => {
      const result = await groupService.finish(ctx().code, ctx().memberId, placeId ?? null);
      afterVoteOrFinish(result);
      return result;
    });

    on('group:leave', null, async () => {
      const { code } = ctx();
      const result = await groupService.leave(code, ctx().memberId);
      if (result.ok) {
        socket.leave(room(code));
        socket.data.code = null;
        socket.data.memberId = null;
        if (result.data.group) {
          io.to(room(code)).emit('group:state', result.data.group);
          if (result.data.finished) io.to(room(code)).emit('group:result', result.data.group.result);
        }
      }
      return result;
    });

    // Phone locked / network drop: mark offline (unless the same member has another socket open);
    // a creator still offline after the grace period hands over to the next member.
    socket.on('disconnect', async () => {
      const { code, memberId } = socket.data;
      if (!code || !memberId) return;
      try {
        const others = (await io.in(room(code)).fetchSockets()).some((s) => s.data.memberId === memberId);
        if (others) return;
        const result = await groupService.setConnected(code, memberId, false);
        if (!result.ok) return;
        broadcast(result.data);
        if (result.data.creatorId === memberId && result.data.status !== 'done') {
          const graceMs = (await configService.get('group_creator_grace_seconds')) * 1000;
          const key = `${code}:${memberId}`;
          graceTimers.set(key, setTimeout(async () => {
            graceTimers.delete(key);
            const handover = await groupService.handoverIfCreatorAway(code, memberId);
            if (handover.ok) broadcast(handover.data);
          }, graceMs));
        }
      } catch (err) {
        console.error('[socket] disconnect handling failed', err);
      }
    });
  });

  return { close: () => graceTimers.forEach((t) => clearTimeout(t)) };
};
