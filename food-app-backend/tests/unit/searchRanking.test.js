import { matchPercent, combine, scoreParts, reasonFor, openingText, budgetBucket, spiceFit } from '../../src/services/helpers/ranking.js';

describe('Match for you %', () => {
  const dish = { typicalSpice: 'very_spicy', typicalSweetness: null, typicalOiliness: 'medium', price: 220, cuisineId: 3 };

  test('spice lover vs mild eater', () => {
    const lover = { effective: { spice: 4, sweet: null, oiliness: 2, budget: 2 }, cuisineIds: [3] };
    const mild = { effective: { spice: 1, sweet: null, oiliness: 2, budget: 2 }, cuisineIds: [5] };
    expect(matchPercent(lover, dish)).toBe(100);
    expect(matchPercent(mild, dish)).toBe(Math.round(((0 + 1 + 1 + 0.5) / 4) * 100));
  });

  test('nothing comparable → null; no profile → null', () => {
    expect(matchPercent({ effective: {}, cuisineIds: [] }, {})).toBeNull();
    expect(matchPercent(null, dish)).toBeNull();
  });

  test('budget buckets (<150 / 150–300 / 300–600 / 600+)', () => {
    expect([90, 150, 299, 300, 650].map(budgetBucket)).toEqual([1, 2, 2, 3, 4]);
  });

  test('query spice fit', () => {
    expect(spiceFit('spicy', 'spicy')).toBe(1);
    expect(spiceFit('spicy', 'mild')).toBeCloseTo(1 / 3);
  });
});

describe('search score', () => {
  const weights = { dish: 0.4, distance: 0.2, tag: 0.15, taste: 0.1, vibe: 0.1, open: 0.05 };

  test('parts that do not apply are left out (weights re-normalised)', () => {
    const parts = scoreParts({ menuItemId: 1, bayesScore: 4.5, tagIds: [], openNow: true, hasHours: true }, { priorMean: 3.5 });
    expect(parts).toEqual({ dish: 0.9, open: 1 });
    expect(combine(parts, weights)).toBeCloseTo((0.4 * 0.9 + 0.05 * 1) / 0.45, 5);
  });

  test('tag fit = share of wanted tags the place has; unknown hours count half', () => {
    const parts = scoreParts({ placeAvgStars: null, tagIds: [7], openNow: false, hasHours: false }, { priorMean: 3.5, tagIds: [7, 9] });
    expect(parts).toEqual({ dish: 0.7, tag: 0.5, open: 0.5 });
  });
});

describe('reason template', () => {
  test('dish result', () => {
    const c = { menuItemId: 1, standardDishName: 'Chicken Dum Biryani', avgStars: 4.6, ratingCount: 80, typicalSpice: 'spicy', price: 220, distanceM: 1234 };
    expect(reasonFor(c, { opening: { state: 'open', closesAt: '23:00', closingSoon: false } }))
      .toBe('Chicken Dum Biryani 4.6★ (80) · Spicy · ₹220 · 1.2 km · Open till 11 PM');
  });

  test('place result with tags; no rating yet', () => {
    expect(reasonFor({ placeReviewCount: 12, placeAvgStars: 4.2, distanceM: 450 }, { tagNames: ['Work'] }))
      .toBe('4.2★ (12 reviews) · Good for Work · 450 m');
    expect(reasonFor({ menuItemId: 2, standardDishName: 'Dalma', ratingCount: 0, price: 90 })).toBe('Dalma · new · ₹90');
  });

  test('opening texts', () => {
    expect(openingText({ state: 'open', closesAt: '22:30', closingSoon: true })).toBe('Closes soon (10:30 PM)');
    expect(openingText({ state: 'closed', opensAt: '09:00', opensToday: true })).toBe('Opens at 9 AM');
    expect(openingText({ state: 'unknown' })).toBeNull();
  });
});
