// Auth test helpers. Google is mocked in each test file with jest.unstable_mockModule
// (no network, no real client ID). These helpers build tokens for direct middleware tests.
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env.js';

export const accessTokenFor = (user, { expiresIn = 900 } = {}) =>
  jwt.sign({ sub: user.id, role: user.role ?? 'user' }, env.jwtSecret, { algorithm: 'HS256', expiresIn });

export const guestPass = (groupCode = 'ABC123') =>
  jwt.sign({ type: 'guest', guestId: 'g-1', groupCode }, env.jwtSecret, { algorithm: 'HS256', expiresIn: 4 * 3600 });

// Pulls "refresh_token=…" out of a supertest response's Set-Cookie header.
export const refreshCookieFrom = (res) => {
  const cookie = (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('refresh_token='));
  return cookie ? cookie.split(';')[0] : null;
};

export const googlePayload = (overrides = {}) => ({
  sub: 'google-123',
  email: 'sangram@example.com',
  email_verified: true,
  name: 'Sangram',
  picture: 'https://example.com/a.png',
  ...overrides,
});
