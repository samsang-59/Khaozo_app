import { moodTagsForReview, mealTagForTime } from '../../src/services/helpers/tag.js';
import { scoreFor } from '../../src/services/helpers/trust.js';

const ist = (t) => new Date(`2026-09-20T${t}:00+05:30`);

describe('mood tag rules', () => {
  test('quiet + Wi-Fi + plug points → Work', () => {
    expect(moodTagsForReview({ noise: 'quiet', wifi: true, plugPoints: true })).toEqual(['Work']);
    expect(moodTagsForReview({ noise: 'moderate', wifi: true, plugPoints: true })).toEqual([]);
    expect(moodTagsForReview({ noise: 'quiet', wifi: true, plugPoints: null })).toEqual([]);
  });

  test('vibe 4+ and looks 4+ and not loud → Date', () => {
    expect(moodTagsForReview({ vibe: 4, looks: 5, noise: 'moderate' })).toEqual(['Date']);
    expect(moodTagsForReview({ vibe: 5, looks: 5, noise: 'loud' })).toEqual([]);
    expect(moodTagsForReview({ vibe: 3, looks: 5, noise: 'quiet' })).toEqual([]);
  });
});

describe('meal-time from rating time (IST)', () => {
  test('7–11 AM → Breakfast', () => {
    expect(mealTagForTime(ist('07:00'))).toBe('Breakfast');
    expect(mealTagForTime(ist('10:59'))).toBe('Breakfast');
    expect(mealTagForTime(ist('11:00'))).toBeNull();
  });

  test('other windows, incl. late night past midnight', () => {
    expect(mealTagForTime(ist('13:30'))).toBe('Lunch');
    expect(mealTagForTime(ist('17:00'))).toBe('Evening snacks');
    expect(mealTagForTime(ist('20:30'))).toBe('Dinner');
    expect(mealTagForTime(ist('23:30'))).toBe('Late night');
    expect(mealTagForTime(ist('01:30'))).toBe('Late night');
    expect(mealTagForTime(ist('05:00'))).toBeNull();
  });
});

describe('trust score formula', () => {
  const rules = { agreeBonus: 0.05, farPenalty: 0.2, verifiedPlaceBonus: 0.1, min: 0.1, max: 3.0 };
  test('starts at 1, moves with agreement, clamped', () => {
    expect(scoreFor({}, rules)).toBe(1);
    expect(scoreFor({ agree: 10, verifiedPlaces: 2 }, rules)).toBe(1.7);
    expect(scoreFor({ far: 20 }, rules)).toBe(0.1);
    expect(scoreFor({ agree: 100 }, rules)).toBe(3);
  });
});
