// trustService (helper) — trust level + weight of a user.
// Phase 3: weight function (used for confirmation weight snapshots).
// Phase 5 adds the trust score recalculation job.
import * as configService from './config.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// user: { createdAt, trustScore }
export const levelFor = (user, { newAccountDays, trustedMinScore }, now = new Date()) => {
  const ageDays = (now.getTime() - new Date(user.createdAt).getTime()) / DAY_MS;
  if (ageDays < newAccountDays) return 'new';
  if (user.trustScore >= trustedMinScore) return 'trusted';
  return 'normal';
};

export const weightFor = async (user, now = new Date()) => {
  const all = await configService.getAll();
  const level = levelFor(user, { newAccountDays: all.new_account_days, trustedMinScore: all.trusted_min_score }, now);
  return { level, weight: all.trust_weights[level] };
};
