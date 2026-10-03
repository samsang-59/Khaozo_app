// api/client.js: unwrap, error mapping, and the single-flight refresh (two refreshes racing
// would make the backend reject one and clear the cookie → logged out).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import axios from 'axios';
import { api, ApiError, cleanParams, getAccessToken, http, onAuthEvent, refreshSession, setAccessToken } from '@/api/client.js';

// Route every request through a fake adapter: (config) → { status, data }
let handler;
const adapter = async (config) => {
  const { status, data } = await handler(config);
  const response = { status, data, headers: {}, config, statusText: String(status) };
  if (status >= 400) {
    const err = new axios.AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', config, null, response);
    throw err;
  }
  return response;
};

beforeEach(() => {
  http.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
  setAccessToken(null);
});
afterEach(() => vi.restoreAllMocks());

const ok = (data) => ({ status: 200, data: { success: true, data } });
const fail = (status, code, message = 'nope', details) => ({ status, data: { success: false, error: { code, message, details } } });

describe('unwrap + errors', () => {
  test('returns data from { success, data }', async () => {
    handler = async () => ok({ id: 1 });
    await expect(api.get('/places/1')).resolves.toEqual({ id: 1 });
  });

  test('API failure → ApiError with code, message, status, details', async () => {
    handler = async () => fail(409, 'RATING_TOO_SOON', 'You rated this dish recently', { ratingId: 7 });
    const err = await api.post('/menu-items/1/ratings', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'RATING_TOO_SOON', status: 409, details: { ratingId: 7 } });
  });

  test('429 without a body → RATE_LIMITED', async () => {
    handler = async () => ({ status: 429, data: '' });
    await expect(api.get('/search')).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  });

  test('cleanParams drops empty values', () => {
    expect(cleanParams({ a: 1, b: '', c: null, d: undefined, e: 0, f: false })).toEqual({ a: 1, e: 0, f: false });
  });
});

describe('access token + refresh', () => {
  test('adds the bearer token to requests', async () => {
    setAccessToken('t1');
    handler = async (config) => ok(config.headers.Authorization);
    await expect(api.get('/me')).resolves.toBe('Bearer t1');
  });

  test('parallel 401s share ONE refresh, then each request retries with the new token', async () => {
    setAccessToken('expired');
    let refreshCalls = 0;
    handler = async (config) => {
      if (config.url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return ok({ user: { id: 1 }, accessToken: 'fresh' });
      }
      return config.headers.Authorization === 'Bearer fresh' ? ok(config.url) : fail(401, 'UNAUTHORIZED');
    };
    const results = await Promise.all([api.get('/me'), api.get('/me/journal'), api.get('/me/notes')]);
    expect(results).toEqual(['/me', '/me/journal', '/me/notes']);
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBe('fresh');
  });

  test('start-up refresh and a request refresh share the same promise', async () => {
    let refreshCalls = 0;
    handler = async () => {
      refreshCalls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return ok({ user: { id: 2 }, accessToken: 'x' });
    };
    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
    expect(a).toEqual(b);
    expect(refreshCalls).toBe(1);
  });

  test('refresh 401 → logged_out event, token cleared, original error thrown', async () => {
    setAccessToken('expired');
    const events = [];
    const off = onAuthEvent((type) => events.push(type));
    handler = async (config) => (config.url.endsWith('/auth/refresh') ? fail(401, 'SESSION_INVALID') : fail(401, 'UNAUTHORIZED'));
    await expect(api.get('/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(events).toContain('logged_out');
    expect(getAccessToken()).toBeNull();
    off();
  });

  test('no refresh when logged out (no token) — the 401 just comes back', async () => {
    let refreshCalls = 0;
    handler = async (config) => {
      if (config.url.endsWith('/auth/refresh')) refreshCalls += 1;
      return fail(401, 'UNAUTHORIZED');
    };
    await expect(api.post('/me/notes', {})).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(0);
  });

  test('a guest-pass request never triggers a user refresh', async () => {
    setAccessToken('user-token');
    let refreshCalls = 0;
    handler = async (config) => {
      if (config.url.endsWith('/auth/refresh')) refreshCalls += 1;
      return fail(401, 'UNAUTHORIZED');
    };
    await expect(api.post('/groups/ABC123/join', {}, { headers: { Authorization: 'Bearer guest' }, skipAuthRefresh: true })).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(0);
  });
});
