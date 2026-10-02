// tasteProfileRepo — taste_profiles + taste_profile_cuisines + taste_profile_avoid.
import { pool, withTransaction } from '../config/db.js';
import { toCamel } from '../utils/caseMapper.js';

const SELECT_PROFILE = `
  SELECT tp.*,
         COALESCE((SELECT array_agg(cuisine_id ORDER BY cuisine_id) FROM taste_profile_cuisines WHERE user_id = tp.user_id), '{}') AS cuisine_ids,
         COALESCE((SELECT array_agg(main_ingredient_id ORDER BY main_ingredient_id) FROM taste_profile_avoid WHERE user_id = tp.user_id), '{}') AS avoid_ids
  FROM taste_profiles tp
  WHERE tp.user_id = $1`;

const findWith = async (db, userId) => {
  const { rows } = await db.query(SELECT_PROFILE, [userId]);
  return toCamel(rows[0]) ?? null;
};

export const findByUserId = (userId) => findWith(pool, userId);

const replaceLists = async (client, userId, { cuisineIds, avoidIds }) => {
  if (cuisineIds !== undefined) {
    await client.query('DELETE FROM taste_profile_cuisines WHERE user_id = $1', [userId]);
    if (cuisineIds.length) {
      await client.query(
        'INSERT INTO taste_profile_cuisines (user_id, cuisine_id) SELECT $1, unnest($2::bigint[])',
        [userId, cuisineIds],
      );
    }
  }
  if (avoidIds !== undefined) {
    await client.query('DELETE FROM taste_profile_avoid WHERE user_id = $1', [userId]);
    if (avoidIds.length) {
      await client.query(
        'INSERT INTO taste_profile_avoid (user_id, main_ingredient_id) SELECT $1, unnest($2::bigint[])',
        [userId, avoidIds],
      );
    }
  }
};

// Quiz answers (any can be null = skipped) + lists, quiz_done = true. One transaction.
export const saveQuiz = async (userId, { diet, spice, sweet, budget, cuisineIds, avoidIds }) =>
  withTransaction(async (client) => {
    await client.query(
      `UPDATE taste_profiles
       SET diet = $2, spice_quiz = $3, sweet_quiz = $4, budget_quiz = $5,
           quiz_done = true, updated_at = now()
       WHERE user_id = $1`,
      [userId, diet, spice, sweet, budget],
    );
    await replaceLists(client, userId, { cuisineIds, avoidIds });
    return findWith(client, userId);
  });

// User edits: value goes into <field>_learned and <field>_locked = true, so
// background learning never changes it again. diet and lists are set directly.
// edits: { diet?, spice?, sweet?, oiliness?, budget?, cuisineIds?, avoidIds? }
export const saveEdits = async (userId, { diet, spice, sweet, oiliness, budget, cuisineIds, avoidIds }) =>
  withTransaction(async (client) => {
    const sets = [];
    const params = [userId];
    const add = (sql, value) => {
      params.push(value);
      sets.push(sql.replaceAll('?', `$${params.length}`));
    };
    if (diet !== undefined) add('diet = ?', diet);
    if (spice !== undefined) add('spice_learned = ?, spice_locked = true', spice);
    if (sweet !== undefined) add('sweet_learned = ?, sweet_locked = true', sweet);
    if (oiliness !== undefined) add('oiliness_learned = ?, oiliness_locked = true', oiliness);
    if (budget !== undefined) add('budget_learned = ?, budget_locked = true', budget);
    sets.push('updated_at = now()');
    await client.query(`UPDATE taste_profiles SET ${sets.join(', ')} WHERE user_id = $1`, params);
    await replaceLists(client, userId, { cuisineIds, avoidIds });
    return findWith(client, userId);
  });
