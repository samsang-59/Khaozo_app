// Rate limits: Redis counters (cacheRepo), per user when logged in, else per IP → 429 + Retry-After.
// Limits live in config (rate_limits: [max, windowSeconds] per "user" / "ip").
// Generous per-IP guest limits (hostels / colleges share one IP), strict per-user limits.
import { verifyAccessToken } from '../services/auth.service.js';
import * as configService from '../services/helpers/config.js';
import * as cacheRepo from '../repositories/redis/cache.repo.js';
import { sendFailure } from '../utils/reasons.js';

// Who is calling: req.user if auth already ran, else a valid bearer token, else the IP.
const identify = (req) => {
  if (req.user?.id) return { kind: 'user', id: req.user.id };
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  const user = scheme === 'Bearer' && token ? verifyAccessToken(token) : null;
  if (user) return { kind: 'user', id: user.id };
  return { kind: 'ip', id: req.ip };
};

export const rateLimit = (name) => async (req, res, next) => {
  if (req.app.locals.rateLimits === false) return next();
  const rules = (await configService.get('rate_limits'))[name];
  const who = identify(req);
  const rule = rules?.[who.kind];
  if (!rule) return next(); // e.g. no per-IP rule for routes that need login anyway
  const [max, windowSeconds] = rule;
  const { count, ttlSeconds } = await cacheRepo.incrementWindow(`rl:${name}:${who.kind}:${who.id}`, windowSeconds);
  if (count > max) {
    res.set('Retry-After', String(Math.max(ttlSeconds, 1)));
    return sendFailure(res, 'RATE_LIMITED');
  }
  next();
};
