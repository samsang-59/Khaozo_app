import { keywordParse } from '../../src/ai/keywordParser.js';

const AREAS = ['KIIT', 'Patia', 'Saheed Nagar', 'Old Town'];

describe('keyword parser (AI fallback)', () => {
  test('the plan example', () => {
    expect(keywordParse('spicy chicken biryani near KIIT under 250 open now', AREAS)).toEqual({
      dish: 'chicken biryani', spice: 'spicy', maxPrice: 250, area: 'KIIT', openNow: true,
      mood: null, mealTime: null, diet: null, vibe: null,
    });
  });

  test('prices in different forms', () => {
    expect(keywordParse('momos below ₹150').maxPrice).toBe(150);
    expect(keywordParse('thali under rs 200').maxPrice).toBe(200);
    expect(keywordParse('pizza within 400').maxPrice).toBe(400);
  });

  test('non-veg is not read as veg; pure veg is veg', () => {
    expect(keywordParse('non-veg thali').diet).toBe('non_veg');
    expect(keywordParse('pure veg thali in Saheed Nagar', AREAS)).toMatchObject({ diet: 'veg', area: 'Saheed Nagar', dish: 'thali' });
  });

  test('mood, meal time, vibe and spice words', () => {
    expect(keywordParse('cozy cafe to study')).toMatchObject({ mood: 'Study', vibe: 'cozy', dish: null });
    expect(keywordParse('very spicy chicken for dinner')).toMatchObject({ spice: 'very_spicy', mealTime: 'Dinner', dish: 'chicken' });
    expect(keywordParse('quiet place to work with laptop')).toMatchObject({ mood: 'Work', vibe: 'calm' });
    expect(keywordParse('cheap breakfast near old town', AREAS)).toMatchObject({ mood: 'Budget', mealTime: 'Breakfast', area: 'Old Town' });
  });

  test('plain dish name stays the dish', () => {
    expect(keywordParse('dahibara aloodum')).toMatchObject({ dish: 'dahibara aloodum', area: null });
  });
});
