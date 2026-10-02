import { ok, fail } from '../../src/utils/result.js';

describe('result', () => {
  test('ok wraps data', () => {
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 } });
    expect(ok()).toEqual({ ok: true, data: null });
  });

  test('fail carries a reason and optional details', () => {
    expect(fail('RATING_TOO_SOON')).toEqual({ ok: false, reason: 'RATING_TOO_SOON' });
    expect(fail('VALIDATION_ERROR', [{ path: 'stars' }])).toEqual({
      ok: false,
      reason: 'VALIDATION_ERROR',
      details: [{ path: 'stars' }],
    });
  });
});
