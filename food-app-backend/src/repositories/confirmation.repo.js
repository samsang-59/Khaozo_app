// confirmationRepo — place_confirmations ("yes, this place exists").
import { pool, withTransaction } from '../config/db.js';

// Insert the confirmation (weight = trust snapshot), re-sum, and flip the place to verified
// when the sum reaches the threshold — all in one transaction with the place row locked.
// Returns { inserted: false } if this user already confirmed.
export const confirmAndMaybeVerify = async ({ placeId, userId, weight, threshold }) =>
  withTransaction(async (client) => {
    await client.query('SELECT id FROM places WHERE id = $1 FOR UPDATE', [placeId]);
    const ins = await client.query(
      `INSERT INTO place_confirmations (place_id, confirmed_by, weight) VALUES ($1, $2, $3)
       ON CONFLICT (place_id, confirmed_by) DO NOTHING`,
      [placeId, userId, weight],
    );
    if (ins.rowCount === 0) return { inserted: false };
    const { rows } = await client.query(
      'SELECT COALESCE(SUM(weight), 0)::float AS total FROM place_confirmations WHERE place_id = $1',
      [placeId],
    );
    const total = rows[0].total;
    let verified = false;
    if (total >= threshold) {
      const upd = await client.query(
        `UPDATE places SET status = 'verified', verified_at = now(), updated_at = now()
         WHERE id = $1 AND status = 'unverified'`,
        [placeId],
      );
      verified = upd.rowCount === 1;
    }
    return { inserted: true, total, verified };
  });

// { placeId: total weight } — e.g. "3.5 / 5 confirmations"
export const sumWeights = async (placeIds) => {
  if (placeIds.length === 0) return {};
  const { rows } = await pool.query(
    `SELECT place_id, SUM(weight)::float AS total FROM place_confirmations
     WHERE place_id = ANY($1::bigint[]) GROUP BY place_id`,
    [placeIds],
  );
  return Object.fromEntries(rows.map((r) => [r.place_id, r.total]));
};

export const hasConfirmed = async (placeId, userId) => {
  const { rows } = await pool.query(
    'SELECT 1 FROM place_confirmations WHERE place_id = $1 AND confirmed_by = $2',
    [placeId, userId],
  );
  return rows.length > 0;
};
