// tasteProfileService — quiz, edit + lock field, blend quiz/learned (learning job in Phase 5).
import * as tasteProfileRepo from '../repositories/tasteProfile.repo.js';
import * as metaRepo from '../repositories/meta.repo.js';
import { ok, fail } from '../utils/result.js';
import * as ratingRepo from '../repositories/rating.repo.js';
import { toView } from '../utils/taste.js';

// Blend rules live in utils/taste.js (also used by search for Match %)
export { BLEND_FULL_AT_RATINGS, blendField, toView } from '../utils/taste.js';

const checkLists = async ({ cuisineIds, avoidIds }) => {
  if (cuisineIds && (await metaRepo.countExisting('cuisines', cuisineIds)) !== new Set(cuisineIds).size) return 'CUISINE_NOT_FOUND';
  if (avoidIds && (await metaRepo.countExisting('main_ingredients', avoidIds)) !== new Set(avoidIds).size) return 'INGREDIENT_NOT_FOUND';
  return null;
};

export const get = async (userId) => {
  const profile = await tasteProfileRepo.findByUserId(userId);
  if (!profile) return fail('TASTE_PROFILE_NOT_FOUND');
  return ok(toView(profile));
};

// PUT — the onboarding quiz (every question skippable → null).
export const saveQuiz = async (userId, quiz) => {
  const problem = await checkLists(quiz);
  if (problem) return fail(problem);
  const profile = await tasteProfileRepo.saveQuiz(userId, {
    diet: quiz.diet ?? null,
    spice: quiz.spice ?? null,
    sweet: quiz.sweet ?? null,
    budget: quiz.budget ?? null,
    cuisineIds: [...new Set(quiz.cuisineIds ?? [])],
    avoidIds: [...new Set(quiz.avoidIds ?? [])],
  });
  if (!profile) return fail('TASTE_PROFILE_NOT_FOUND');
  return ok(toView(profile));
};

// PATCH — user edits individual fields; each edited learnable field becomes locked.
export const edit = async (userId, edits) => {
  const problem = await checkLists(edits);
  if (problem) return fail(problem);
  const profile = await tasteProfileRepo.saveEdits(userId, {
    ...edits,
    cuisineIds: edits.cuisineIds && [...new Set(edits.cuisineIds)],
    avoidIds: edits.avoidIds && [...new Set(edits.avoidIds)],
  });
  if (!profile) return fail('TASTE_PROFILE_NOT_FOUND');
  return ok(toView(profile));
};

// ---- Learning job (after a rating) ------------------------------------------------

// "Liked" dishes teach the profile; locked fields are never changed (enforced in the repo too).
export const LIKED_MIN_STARS = 4;

export const learn = async (userId) => {
  const s = await ratingRepo.tasteSignals(userId, LIKED_MIN_STARS);
  const updated = await tasteProfileRepo.saveLearned(userId, {
    spice: s.spice, sweet: s.sweet, oiliness: s.oiliness, budget: s.budget, ratingsUsed: s.ratingsUsed,
  });
  return updated ? ok({ ratingsUsed: s.ratingsUsed }) : fail('TASTE_PROFILE_NOT_FOUND');
};
