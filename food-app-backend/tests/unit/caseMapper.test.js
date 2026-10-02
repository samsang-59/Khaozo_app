import { snakeToCamel, camelToSnake, toCamel, rowsToCamel } from '../../src/utils/caseMapper.js';

describe('caseMapper', () => {
  test('snakeToCamel converts keys', () => {
    expect(snakeToCamel('would_order_again')).toBe('wouldOrderAgain');
    expect(snakeToCamel('id')).toBe('id');
    expect(snakeToCamel('day_0_open')).toBe('day0Open');
  });

  test('camelToSnake converts keys', () => {
    expect(camelToSnake('menuItemId')).toBe('menu_item_id');
    expect(camelToSnake('id')).toBe('id');
  });

  test('toCamel converts top-level keys and keeps values untouched', () => {
    const createdAt = new Date('2026-10-02T10:00:00Z');
    const nested = { some_key: 1 };
    const row = { user_id: 7, created_at: createdAt, meta_json: nested, tags: ['a'] };

    const out = toCamel(row);

    expect(out).toEqual({ userId: 7, createdAt, metaJson: nested, tags: ['a'] });
    expect(out.createdAt).toBe(createdAt);
    expect(out.metaJson).toBe(nested); // JSONB values are not rewritten
  });

  test('toCamel passes null/undefined through', () => {
    expect(toCamel(null)).toBeNull();
    expect(toCamel(undefined)).toBeUndefined();
  });

  test('rowsToCamel maps every row', () => {
    expect(rowsToCamel([{ place_id: 1 }, { place_id: 2 }])).toEqual([{ placeId: 1 }, { placeId: 2 }]);
  });
});
