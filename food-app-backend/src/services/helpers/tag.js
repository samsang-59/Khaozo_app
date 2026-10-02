// tagService (helper) — auto tag votes from code rules (not AI). Saved in place_tag_votes
// with source = 'auto' and the contributor's user id, so they count like any other vote
// (a tag shows once tag_min_votes people agree).
import * as reviewRepo from '../../repositories/review.repo.js';
import * as ratingRepo from '../../repositories/rating.repo.js';
import * as tagVoteRepo from '../../repositories/tagVote.repo.js';

// Mood tags from a place review's tick boxes
//  - Work: quiet + Wi-Fi + plug points (plan)
//  - Date: good vibe + good looks (4★+) + quiet / moderate (brainstorm)
export const moodTagsForReview = (r) => {
  const tags = [];
  if (r.noise === 'quiet' && r.wifi === true && r.plugPoints === true) tags.push('Work');
  if (r.vibe >= 4 && r.looks >= 4 && (r.noise === 'quiet' || r.noise === 'moderate')) tags.push('Date');
  return tags;
};

// Meal-time tag from when a dish was rated (IST hour). Breakfast 7–11 AM is from the plan;
// the other windows are ours: [start, end) hours, Late night wraps past midnight.
export const MEAL_WINDOWS = [
  ['Breakfast', 7, 11],
  ['Lunch', 12, 16],
  ['Evening snacks', 16, 19],
  ['Dinner', 19, 23],
  ['Late night', 23, 3],
];

const istHour = (date) => new Date(new Date(date).getTime() + 330 * 60_000).getUTCHours();

export const mealTagForTime = (date) => {
  const h = istHour(date);
  for (const [name, start, end] of MEAL_WINDOWS) {
    const inside = start < end ? h >= start && h < end : h >= start || h < end;
    if (inside) return name;
  }
  return null; // e.g. 3–7 AM, 11 AM–12 PM
};

const idsFor = async (names, type) => {
  if (!names.length) return [];
  const rows = await tagVoteRepo.tagIdsByName(names);
  return rows.filter((t) => t.type === type).map((t) => t.id);
};

export const autoTagReview = async (reviewId) => {
  const review = await reviewRepo.findById(reviewId);
  if (!review || !review.userId) return 0;
  const tagIds = await idsFor(moodTagsForReview(review), 'mood');
  return tagVoteRepo.addAuto(review.placeId, review.userId, tagIds);
};

export const autoTagRating = async (ratingId) => {
  const rating = await ratingRepo.findWithPlace(ratingId);
  if (!rating || !rating.userId) return 0;
  const meal = mealTagForTime(rating.createdAt);
  const tagIds = await idsFor(meal ? [meal] : [], 'meal_time');
  return tagVoteRepo.addAuto(rating.placeId, rating.userId, tagIds);
};
