// sessionRepo — login_sessions (refresh tokens, stored as SHA-256 hashes).
import { pool, withTransaction } from '../config/db.js';
import { toCamel } from '../utils/caseMapper.js';

export const create = async ({ userId, tokenHash, deviceInfo, expiresAt }) => {
  const { rows } = await pool.query(
    `INSERT INTO login_sessions (user_id, token_hash, device_info, expires_at)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, tokenHash, deviceInfo, expiresAt],
  );
  return toCamel(rows[0]);
};

// Session by token hash, plus when it was rotated (= created_at of its replacement).
export const findByHash = async (tokenHash) => {
  const { rows } = await pool.query(
    `SELECT s.*, next.created_at AS replaced_at
     FROM login_sessions s
     LEFT JOIN login_sessions next ON next.id = s.replaced_by
     WHERE s.token_hash = $1`,
    [tokenHash],
  );
  return toCamel(rows[0]) ?? null;
};

// Rotation: create the new session and mark the old one used, in one transaction.
// The old row is only marked if nobody rotated it first (parallel refresh) —
// returns null in that case and nothing is written.
export const rotate = async (oldSessionId, { userId, tokenHash, deviceInfo, expiresAt }) =>
  withTransaction(async (client) => {
    const { rows: [created] } = await client.query(
      `INSERT INTO login_sessions (user_id, token_hash, device_info, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, tokenHash, deviceInfo, expiresAt],
    );
    const { rowCount } = await client.query(
      `UPDATE login_sessions SET replaced_by = $2
       WHERE id = $1 AND replaced_by IS NULL AND revoked_at IS NULL`,
      [oldSessionId, created.id],
    );
    if (rowCount === 0) throw new RotationLostError();
    return toCamel(created);
  }).catch((err) => {
    if (err instanceof RotationLostError) return null;
    throw err;
  });

class RotationLostError extends Error {}

export const revokeForUser = async (tokenHash, userId) => {
  const { rowCount } = await pool.query(
    `UPDATE login_sessions SET revoked_at = now()
     WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [tokenHash, userId],
  );
  return rowCount;
};

export const revokeAllForUser = async (userId) => {
  const { rowCount } = await pool.query(
    'UPDATE login_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [userId],
  );
  return rowCount;
};

// Nightly cleanup (job added in Phase 5)
export const deleteExpired = async () => {
  const { rowCount } = await pool.query('DELETE FROM login_sessions WHERE expires_at < now()');
  return rowCount;
};
