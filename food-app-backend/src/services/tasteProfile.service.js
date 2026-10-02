// tasteProfileService — quiz, edit + lock field, blend quiz/learned (learning job in Phase 5).
import * as tasteProfileRepo from '../repositories/tasteProfile.repo.js';
import * as metaRepo from '../repositories/meta.repo.js';
import { ok, fail } from '../utils/result.js';

// How many rated dishes it takes before learned values fully replace quiz answers.
// The plan says "few ratings → trust quiz, many → trust learned"; the exact number is ours.
export const BLEND_FULL_AT_RATINGS = 20;

// One field: locked → the user's value; otherwise move from quiz to learned as ratings grow.
export const blendField = ({ quiz, learned, locked }, ratingsUsed) => {
  if (locked) return learned ?? quiz ?? null;
  if (learned == null) return quiz ?? null;
  if (quiz == null) return learned;
  const w = Math.min(ratingsUsed / BLEND_FULL_AT_RATINGS, 1);
  return quiz * (1 - w) + learned * w;
};

const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

export const toView = (p) => {
  const field = (name, hasQuiz = true) => ({
    quiz: hasQuiz ? p[`${name}Quiz`] : null,
    learned: p[`${name}Learned`],
    locked: p[`${name}Locked`],
  });
  const fields = { spice: field('spice'), sweet: field('sweet'), oiliness: field('oiliness', false), budget: field('budget') };
  const effective = Object.fromEntries(
    Object.entries(fields).map(([k, f]) => [k, round1(blendField(f, p.ratingsUsed))]),
  );
  return {
    diet: p.diet,
    quizDone: p.quizDone,
    ratingsUsed: p.ratingsUsed,
    cuisineIds: p.cuisineIds,
    avoidIds: p.avoidIds,
    fields,
    effective, // what ranking / Match % use
    updatedAt: p.updatedAt,
  };
};

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
