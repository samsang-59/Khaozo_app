// Test-only access to the backend: its database (pg) and secrets (from env or
// food-app-backend/.env). Used to seed a small world and to sign test users in
// (Google can't be automated: we create a real refresh session and set its cookie).
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../food-app-backend');
const requireBackend = createRequire(path.join(BACKEND, 'package.json'));
const pg = requireBackend('pg');
const jwt = requireBackend('jsonwebtoken');
const { Redis } = requireBackend('ioredis');

const envFile = path.join(BACKEND, '.env');
const fileEnv = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, 'utf8')
        .split('\n')
        .filter((l) => /^\s*[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  : {};
const env = (k) => process.env[k] ?? fileEnv[k];

export const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api/v1';
let pool;
export const db = () => (pool ??= new pg.Pool({ connectionString: env('DATABASE_URL'), max: 3 }));
export const closeDb = async () => {
  const p = pool;
  pool = undefined;
  await p?.end();
};

export const accessToken = (user) => jwt.sign({ sub: user.id, role: user.role ?? 'user' }, env('JWT_SECRET'), { algorithm: 'HS256', expiresIn: 3600 });

export const createUser = async (name, { role = 'user' } = {}) => {
  const tag = crypto.randomBytes(5).toString('hex');
  const { rows } = await db().query(
    `INSERT INTO users (name, email, google_id, role, created_at) VALUES ($1, $2, $3, $4, now() - interval '60 days') RETURNING id, name, role`,
    [name, `e2e-${tag}@example.com`, `e2e-${tag}`, role],
  );
  const user = { ...rows[0], id: Number(rows[0].id) }; // BIGINT comes back as a string from raw pg
  await db().query('INSERT INTO taste_profiles (user_id) VALUES ($1)', [user.id]);
  return user;
};

// Real refresh session → the app's start-up refresh signs this browser in
export const refreshCookie = async (user) => {
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await db().query(
    `INSERT INTO login_sessions (user_id, token_hash, device_info, expires_at) VALUES ($1, $2, 'playwright', now() + interval '1 day')`,
    [user.id, hash],
  );
  return { name: 'refresh_token', value: token, domain: 'localhost', path: '/api/v1/auth', httpOnly: true, sameSite: 'Strict' };
};

export const call = async (method, url, user, body) => {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${accessToken(user)}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 409) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(json)}`);
  return json;
};

// Cached search results (10 min) would hide freshly seeded places → drop them
export const clearSearchCache = async () => {
  const redis = new Redis(env('REDIS_URL'), { lazyConnect: true });
  await redis.connect();
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'search:*', 'COUNT', 500);
    cursor = next;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== '0');
  await redis.quit();
};
