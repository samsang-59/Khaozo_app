import { blendField, BLEND_FULL_AT_RATINGS } from '../../src/services/tasteProfile.service.js';

describe('blendField (quiz → learned as ratings grow)', () => {
  test('no ratings yet → quiz answer', () => {
    expect(blendField({ quiz: 3, learned: 1, locked: false }, 0)).toBe(3);
  });

  test('half way → average', () => {
    expect(blendField({ quiz: 3, learned: 1, locked: false }, BLEND_FULL_AT_RATINGS / 2)).toBe(2);
  });

  test('many ratings → learned value only', () => {
    expect(blendField({ quiz: 3, learned: 1, locked: false }, BLEND_FULL_AT_RATINGS * 3)).toBe(1);
  });

  test('locked → the user\'s value regardless of ratings', () => {
    expect(blendField({ quiz: 1, learned: 4, locked: true }, 0)).toBe(4);
  });

  test('missing values fall back to whatever exists', () => {
    expect(blendField({ quiz: null, learned: 2.5, locked: false }, 0)).toBe(2.5);
    expect(blendField({ quiz: 2, learned: null, locked: false }, 50)).toBe(2);
    expect(blendField({ quiz: null, learned: null, locked: false }, 5)).toBeNull();
  });
});
