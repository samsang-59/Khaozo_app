// tagVoteRepo — place_tag_votes (user ticks are written by reviewRepo in the review transaction;
// this repo writes the code-rule "auto" votes).
import { pool } from '../config/db.js';

// One vote per user per tag per place: an existing user vote for the same tag is kept as is.
export const addAuto = async (placeId, userId, tagIds) => {
  if (!tagIds.length) return 0;
  const { rowCount } = await pool.query(
    `INSERT INTO place_tag_votes (place_id, tag_id, user_id, source)
     SELECT $1, unnest($3::bigint[]), $2, 'auto'
     ON CONFLICT (place_id, tag_id, user_id) DO NOTHING`,
    [placeId, userId, tagIds],
  );
  return rowCount;
};

export const tagIdsByName = async (names) => {
  const { rows } = await pool.query('SELECT id, name, type FROM tags WHERE name = ANY($1::text[])', [names]);
  return rows;
};
