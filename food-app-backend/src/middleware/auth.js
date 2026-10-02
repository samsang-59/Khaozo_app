import { verifyAccessToken, verifyGuestPass } from '../services/auth.service.js';
import { sendFailure } from '../utils/reasons.js';

const bearerToken = (req) => {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

// 🔐 routes: no / invalid / expired token → 401. Guest passes are rejected here.
export const requireAuth = (req, res, next) => {
  const token = bearerToken(req);
  const user = token && verifyAccessToken(token);
  if (!user) return sendFailure(res, 'UNAUTHORIZED');
  req.user = user;
  next();
};

// 🌐 routes that personalise: no token → continue as guest.
// A token that is present but invalid/expired → 401, so the frontend refreshes
// and retries instead of silently losing "Match %" / "your rating".
export const optionalAuth = (req, res, next) => {
  const token = bearerToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  const user = verifyAccessToken(token);
  if (!user) return sendFailure(res, 'UNAUTHORIZED');
  req.user = user;
  next();
};

// Group routes: an access token (logged-in member) OR a guest pass (guest member) OR nothing
// (a new guest). An invalid / expired token → 401.
export const groupIdentity = (req, res, next) => {
  const token = bearerToken(req);
  req.groupIdentity = null;
  if (!token) return next();
  const user = verifyAccessToken(token);
  if (user) {
    req.groupIdentity = { kind: 'user', userId: user.id };
    return next();
  }
  const guest = verifyGuestPass(token);
  if (!guest) return sendFailure(res, 'UNAUTHORIZED');
  req.groupIdentity = { kind: 'guest', guestId: guest.guestId, groupCode: guest.groupCode };
  next();
};
