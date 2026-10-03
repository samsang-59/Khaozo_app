// The only place that talks to the backend over HTTP.
// - baseURL /api/v1 (Vite proxies it in dev), withCredentials for the refresh cookie
// - access token lives in memory only (never localStorage)
// - 401 → ONE shared refresh for every waiting request (single flight), then retry once.
//   Two refreshes racing would make the backend reject the loser and clear the cookie,
//   which logs the user out — so the app's start-up refresh uses the same promise.
// - unwraps { success, data } → data; failures become ApiError { code, message, status, details }
import axios from 'axios';

const API_ROOT = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

export class ApiError extends Error {
  constructor({ code = 'NETWORK_ERROR', message = 'Could not reach Khaozo. Check your connection.', status = 0, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let accessToken = null;
const listeners = new Set();

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token ?? null;
};

// AuthContext subscribes: 'refreshed' (new user/token) and 'logged_out' (refresh failed)
export const onAuthEvent = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = (type, payload) => listeners.forEach((fn) => fn(type, payload));

export const http = axios.create({ baseURL: API_ROOT, withCredentials: true, timeout: 20000 });

const toApiError = (err) => {
  if (err instanceof ApiError) return err;
  const res = err?.response;
  if (!res) {
    if (err?.code === 'ECONNABORTED') return new ApiError({ code: 'TIMEOUT', message: 'Khaozo is taking too long. Try again.' });
    return new ApiError();
  }
  const body = res.data?.error ?? {};
  return new ApiError({
    code: body.code ?? (res.status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR'),
    message: body.message ?? (res.status === 429 ? 'Slow down a bit and try again shortly.' : 'Something went wrong.'),
    status: res.status,
    details: body.details,
  });
};

// ---- single-flight refresh ----------------------------------------------------------
let refreshPromise = null;

// → { user, accessToken } or null (no session). Never throws for "no session".
export const refreshSession = () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_ROOT}/auth/refresh`, null, { withCredentials: true, timeout: 15000 })
      .then((res) => {
        const data = res.data?.data;
        setAccessToken(data?.accessToken);
        emit('refreshed', data);
        return data;
      })
      .catch((err) => {
        const apiErr = toApiError(err);
        if (apiErr.status === 401) {
          setAccessToken(null);
          emit('logged_out', apiErr);
          return null;
        }
        throw apiErr; // network trouble: keep whatever state we had
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

http.interceptors.request.use((config) => {
  // A per-request token (guest pass in group mode) wins over the user's access token
  if (accessToken && !config.headers.Authorization) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

const NO_REFRESH = ['/auth/refresh', '/auth/google', '/auth/logout'];

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err?.config;
    const status = err?.response?.status;
    const canRetry =
      status === 401 && config && !config._retried && !config.skipAuthRefresh && !NO_REFRESH.some((p) => config.url?.startsWith(p));
    // Only a signed-in user can refresh (a guest pass or a logged-out visitor just gets the 401)
    if (canRetry && accessToken) {
      config._retried = true;
      const session = await refreshSession().catch(() => null);
      if (session?.accessToken) {
        config.headers.Authorization = `Bearer ${session.accessToken}`;
        return http(config);
      }
    }
    throw toApiError(err);
  },
);

// Small helpers: every call returns the unwrapped `data`
const unwrap = (p) => p.then((res) => res.data?.data);
export const api = {
  get: (url, params, config = {}) => unwrap(http.get(url, { ...config, params })),
  post: (url, body, config) => unwrap(http.post(url, body, config)),
  put: (url, body, config) => unwrap(http.put(url, body, config)),
  patch: (url, body, config) => unwrap(http.patch(url, body, config)),
  del: (url, body, config = {}) => unwrap(http.delete(url, { ...config, data: body })),
};

// Drop empty filter values so URLs stay clean (and Zod doesn't see "" for numbers)
export const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
