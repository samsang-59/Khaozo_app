// authService — Google login, access + refresh tokens (rotation + reuse detection), logout.
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as userRepo from '../repositories/user.repo.js';
import * as sessionRepo from '../repositories/session.repo.js';
import { ok, fail } from '../utils/result.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;            // 15 min
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const REFRESH_RACE_WINDOW_MS = 10 * 1000;             // parallel-refresh safety net

const googleClient = new OAuth2Client(env.googleClientId);

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });

// Verifies an access token. Returns { userId, role } or null (invalid / expired / guest pass).
export const verifyAccessToken = (token) => {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
    if (payload.type === 'guest' || typeof payload.sub !== 'number') return null;
    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
};

const newRefreshToken = () => {
  const token = crypto.randomBytes(64).toString('base64url');
  return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) };
};

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
  role: u.role,
  journalVisibility: u.journalVisibility,
  createdAt: u.createdAt,
});

// POST /auth/google — verify the Google ID token, find or create the user, issue tokens.
export const loginWithGoogle = async ({ idToken, deviceInfo }) => {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    return fail('GOOGLE_TOKEN_INVALID');
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) return fail('GOOGLE_TOKEN_INVALID');

  let user = await userRepo.findByGoogleId(payload.sub);
  let isNewUser = false;
  if (!user) {
    user = await userRepo.createWithTasteProfile({
      name: payload.name ?? payload.email.split('@')[0],
      email: payload.email,
      googleId: payload.sub,
      avatarUrl: payload.picture ?? null,
    });
    isNewUser = true;
  }

  const refresh = newRefreshToken();
  await sessionRepo.create({ userId: user.id, tokenHash: refresh.tokenHash, deviceInfo, expiresAt: refresh.expiresAt });

  return ok({
    user: publicUser(user),
    isNewUser,
    accessToken: signAccessToken(user),
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
  });
};

// POST /auth/refresh — rotate the refresh token.
export const refresh = async ({ refreshToken, deviceInfo }) => {
  if (!refreshToken) return fail('SESSION_INVALID');
  const session = await sessionRepo.findByHash(hashToken(refreshToken));
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return fail('SESSION_INVALID');

  if (session.replacedBy) {
    // Already used. Within 10 s of its rotation → parallel requests racing, not theft.
    const sinceRotation = Date.now() - new Date(session.replacedAt).getTime();
    if (sinceRotation <= REFRESH_RACE_WINDOW_MS) return fail('SESSION_INVALID');
    // Reuse = the token was stolen → log out every device of this user.
    await sessionRepo.revokeAllForUser(session.userId);
    return fail('SESSION_REUSED');
  }

  const user = await userRepo.findById(session.userId);
  if (!user) return fail('SESSION_INVALID');

  const next = newRefreshToken();
  const rotated = await sessionRepo.rotate(session.id, {
    userId: user.id,
    tokenHash: next.tokenHash,
    deviceInfo,
    expiresAt: next.expiresAt,
  });
  if (!rotated) return fail('SESSION_INVALID'); // lost a parallel race

  return ok({
    user: publicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: next.token,
    refreshExpiresAt: next.expiresAt,
  });
};

// POST /auth/logout — revoke this device's session (if the cookie is present).
export const logout = async ({ userId, refreshToken }) => {
  if (refreshToken) await sessionRepo.revokeForUser(hashToken(refreshToken), userId);
  return ok();
};

// POST /auth/logout-all — revoke every session of the user.
export const logoutAll = async ({ userId }) => {
  const revoked = await sessionRepo.revokeAllForUser(userId);
  return ok({ revoked });
};
