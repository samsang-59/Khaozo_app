// trustService (helper) — trust level + weight of a user.
// Phase 3: weight function (used for confirmation weight snapshots).
// Phase 5 adds the trust score recalculation job.
import * as configService from './config.js';
import * as ratingRepo from '../../repositories/rating.repo.js';
import * as placeRepo from '../../repositories/place.repo.js';
import * as userRepo from '../../repositories/user.repo.js';

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

// ---- Trust score recalculation (nightly job) ------------------------------------

// trust = 1 + agreeBonus × agree − farPenalty × far + verifiedPlaceBonus × verified places, clamped
export const scoreFor = ({ agree = 0, far = 0, verifiedPlaces = 0 }, rules) => {
  const raw = 1 + rules.agreeBonus * agree - rules.farPenalty * far + rules.verifiedPlaceBonus * verifiedPlaces;
  return Math.round(Math.min(rules.max, Math.max(rules.min, raw)) * 1000) / 1000;
};

export const recalculateAll = async () => {
  const all = await configService.getAll();
  const rules = all.trust_rules;
  const [signals, verified, userIds] = await Promise.all([
    ratingRepo.trustSignals({ minOthers: all.min_ratings_for_label, agreeWithin: rules.agreeWithin, farOff: rules.farOff }),
    placeRepo.verifiedCountsByAdder(),
    userRepo.allIds(),
  ]);
  const byUser = Object.fromEntries(signals.map((s) => [s.userId, s]));
  const scores = userIds.map((id) => ({
    userId: id,
    trustScore: scoreFor({ ...byUser[id], verifiedPlaces: verified[id] ?? 0 }, rules),
  }));
  return { updated: await userRepo.setTrustScores(scores) };
};
