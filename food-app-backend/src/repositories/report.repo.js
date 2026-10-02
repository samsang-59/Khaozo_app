// reportRepo — place_reports (admin accept / reject added in Phase 8).
import { pool } from '../config/db.js';
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
