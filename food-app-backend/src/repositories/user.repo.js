// userRepo — users table (+ deleteAccount across all tables in Phase 8).
import { pool, withTransaction } from '../config/db.js';
import { toCamel } from '../utils/caseMapper.js';

const COLUMNS = `id, name, email, google_id, avatar_url, role, trust_score, journal_visibility, created_at, updated_at`;

export const findById = async (id) => {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
  return toCamel(rows[0]) ?? null;
};

export const findByGoogleId = async (googleId) => {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM users WHERE google_id = $1`, [googleId]);
  return toCamel(rows[0]) ?? null;
};

// New user + empty taste profile, together.
export const createWithTasteProfile = async ({ name, email, googleId, avatarUrl }) =>
  withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO users (name, email, google_id, avatar_url) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [name, email, googleId, avatarUrl],
    );
    await client.query('INSERT INTO taste_profiles (user_id) VALUES ($1)', [rows[0].id]);
    return toCamel(rows[0]);
  });

// fields: { name?, journalVisibility? } — only the given ones change.
export const updateProfile = async (id, { name, journalVisibility }) => {
  const { rows } = await pool.query(
    `UPDATE users
     SET name = COALESCE($2, name),
         journal_visibility = COALESCE($3, journal_visibility),
         updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, name ?? null, journalVisibility ?? null],
  );
  return toCamel(rows[0]) ?? null;
};

export const setRoleByEmail = async (email, role) => {
  const { rows } = await pool.query(
    `UPDATE users SET role = $2, updated_at = now() WHERE lower(email) = lower($1) RETURNING ${COLUMNS}`,
    [email, role],
  );
  return toCamel(rows[0]) ?? null;
};

// Public journal header (only name + avatar are ever shown to others)
export const findPublicById = async (id) => {
  const { rows } = await pool.query('SELECT id, name, avatar_url, journal_visibility FROM users WHERE id = $1', [id]);
  return toCamel(rows[0]) ?? null;
};

// Trust job: set many users' scores at once ([{ userId, trustScore }])
export const setTrustScores = async (scores) => {
  if (!scores.length) return 0;
  const { rowCount } = await pool.query(
    `UPDATE users u SET trust_score = s.score, updated_at = now()
     FROM unnest($1::bigint[], $2::float[]) AS s(id, score)
     WHERE u.id = s.id AND u.trust_score IS DISTINCT FROM s.score`,
    [scores.map((s) => s.userId), scores.map((s) => s.trustScore)],
  );
  return rowCount;
};

export const allIds = async () => (await pool.query('SELECT id FROM users')).rows.map((r) => r.id);
