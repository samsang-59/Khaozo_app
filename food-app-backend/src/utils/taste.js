// Taste profile maths (pure): quiz → learned blend and the API view.
// Shared by tasteProfileService and searchService (feature services never call each other).

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
