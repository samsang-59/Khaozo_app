// groupRepo — group_sessions · group_session_members (history of finished groups only).
import { pool, withTransaction } from '../config/db.js';
import { rowsToCamel } from '../utils/caseMapper.js';

export const codeUsed = async (code) => (await pool.query('SELECT 1 FROM group_sessions WHERE code = $1', [code])).rowCount > 0;

// Saved only when a winner is picked; guests are counted, never stored.
export const saveFinished = async ({ code, createdBy, locationLabel, location, winningPlaceId, guestCount, startedAt, endedAt, members }) =>
  withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO group_sessions (code, created_by, location_label, location, winning_place_id, guest_count, started_at, ended_at)
       VALUES ($1, $2, $3, CASE WHEN $4::float IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography END,
               $6, $7, $8, $9)
       RETURNING id`,
      [code, createdBy, locationLabel, location?.lat ?? null, location?.lng ?? null, winningPlaceId, guestCount, startedAt, endedAt],
    );
    for (const m of members) {
      await client.query(
        'INSERT INTO group_session_members (group_session_id, user_id, joined_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [rows[0].id, m.userId, m.joinedAt],
      );
    }
    return rows[0].id;
  });

// GET /me/groups — past groups this user was part of
export const listForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT g.id, g.code, g.location_label, g.guest_count, g.started_at, g.ended_at,
            p.id AS place_id, p.name AS place_name, a.name AS area_name,
            (SELECT COUNT(*) FROM group_session_members x WHERE x.group_session_id = g.id)::int AS member_count,
            (g.created_by = $1) AS was_creator
     FROM group_sessions g
     JOIN group_session_members gm ON gm.group_session_id = g.id AND gm.user_id = $1
     JOIN places p ON p.id = g.winning_place_id
     JOIN areas a ON a.id = p.area_id
     ORDER BY g.ended_at DESC`,
    [userId],
  );
  return rowsToCamel(rows);
};
