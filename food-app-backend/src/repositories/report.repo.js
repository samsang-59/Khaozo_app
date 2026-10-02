// reportRepo — place_reports (+ admin accept / reject, which applies the fix in the same transaction).
import { pool, withTransaction } from '../config/db.js';
import * as placeRepo from './place.repo.js';
import { toCamel, rowsToCamel } from '../utils/caseMapper.js';

export const create = async ({ placeId, reportedBy, reason, details, suggestedChange, duplicateOf }) => {
  const { rows } = await pool.query(
    `INSERT INTO place_reports (place_id, reported_by, reason, details, suggested_change, duplicate_of)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, place_id, reason, details, suggested_change, duplicate_of, status, created_at`,
    [placeId, reportedBy, reason, details, suggestedChange, duplicateOf],
  );
  return toCamel(rows[0]);
};

export const hasPending = async ({ placeId, reportedBy, reason }) => {
  const { rows } = await pool.query(
    `SELECT 1 FROM place_reports
     WHERE place_id = $1 AND reported_by = $2 AND reason = $3 AND status = 'pending'`,
    [placeId, reportedBy, reason],
  );
  return rows.length > 0;
};

// Journal → My Contributions
export const findByReporter = async (userId) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.place_id, p.name AS place_name, r.reason, r.status, r.created_at, r.reviewed_at
     FROM place_reports r JOIN places p ON p.id = r.place_id
     WHERE r.reported_by = $1 ORDER BY r.created_at DESC`,
    [userId],
  );
  return rowsToCamel(rows);
};

// ---- Admin (Phase 8) -------------------------------------------------------------

export const findById = async (id) => {
  const { rows } = await pool.query('SELECT * FROM place_reports WHERE id = $1', [id]);
  return toCamel(rows[0]) ?? null;
};

// Admin queue: pending (default) oldest first; accepted / rejected newest first.
export const listForAdmin = async ({ status, limit, cursor }) => {
  const oldestFirst = status === 'pending';
  const params = [status, limit + 1];
  let after = '';
  if (cursor) {
    params.push(cursor.id);
    after = `AND r.id ${oldestFirst ? '>' : '<'} $3::bigint`;
  }
  const { rows } = await pool.query(
    `SELECT r.id, r.reason, r.details, r.suggested_change, r.status, r.created_at, r.reviewed_at,
            r.place_id, p.name AS place_name, p.status AS place_status, p.deleted_at AS place_deleted_at,
            ST_Y(p.location::geometry) AS place_lat, ST_X(p.location::geometry) AS place_lng,
            r.duplicate_of, d.name AS duplicate_of_name,
            r.reported_by, u.name AS reported_by_name, rv.name AS reviewed_by_name
     FROM place_reports r
     JOIN places p ON p.id = r.place_id
     LEFT JOIN places d ON d.id = r.duplicate_of
     LEFT JOIN users u ON u.id = r.reported_by
     LEFT JOIN users rv ON rv.id = r.reviewed_by
     WHERE r.status = $1 ${after}
     ORDER BY r.id ${oldestFirst ? 'ASC' : 'DESC'}
     LIMIT $2`,
    params,
  );
  return rowsToCamel(rows);
};

// Accept / reject a pending report. fix (accept only) is applied to the place in the same
// transaction: { kind: 'close' | 'delete' } · { kind: 'location', lat, lng } · { kind: 'hours', hours }
// · { kind: 'info', fields } · { kind: 'merge', intoId }.
// Returns the updated report, or null if it was no longer pending (another admin got there first).
export const resolve = async (id, { status, reviewedBy, fix }) =>
  withTransaction(async (client) => {
    const { rows } = await client.query(`SELECT place_id FROM place_reports WHERE id = $1 AND status = 'pending' FOR UPDATE`, [id]);
    if (!rows[0]) return null;
    const placeId = rows[0].place_id;
    if (fix?.kind === 'close') await placeRepo.applyAdminAction(placeId, 'close', client);
    if (fix?.kind === 'delete') await placeRepo.applyAdminAction(placeId, 'delete', client);
    if (fix?.kind === 'location') await placeRepo.updateLocation(placeId, fix, client);
    if (fix?.kind === 'hours') await placeRepo.replaceHours(placeId, fix.hours, client);
    if (fix?.kind === 'info') await placeRepo.updateInfo(placeId, fix.fields, client);
    if (fix?.kind === 'merge') await placeRepo.mergeInto(placeId, fix.intoId, client);
    const updated = await client.query(
      `UPDATE place_reports SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1
       RETURNING id, place_id, reason, details, suggested_change, duplicate_of, status, reviewed_at, created_at`,
      [id, status, reviewedBy],
    );
    return toCamel(updated.rows[0]);
  });
