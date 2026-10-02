import { REASONS, getReason, sendFailure } from '../../src/utils/reasons.js';

const fakeRes = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

describe('reasons', () => {
  test('every reason has a status and message', () => {
    for (const [code, entry] of Object.entries(REASONS)) {
      expect(Number.isInteger(entry.status)).toBe(true);
      expect(typeof entry.message).toBe('string');
      expect(code).toMatch(/^[A-Z_]+$/);
    }
  });

  test('unknown reason falls back to INTERNAL_ERROR', () => {
    expect(getReason('NO_SUCH_REASON')).toBe(REASONS.INTERNAL_ERROR);
  });

  test('sendFailure replies in the shared response shape', () => {
    const res = sendFailure(fakeRes(), 'NOT_ALLOWED');
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_ALLOWED', message: REASONS.NOT_ALLOWED.message },
    });
  });

  test('sendFailure includes details when given', () => {
    const res = sendFailure(fakeRes(), 'VALIDATION_ERROR', [{ path: 'stars', message: 'Too big' }]);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.details).toEqual([{ path: 'stars', message: 'Too big' }]);
  });

  test('sendFailure never leaks an unknown reason code', () => {
    const res = sendFailure(fakeRes(), 'SOMETHING_ODD');
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
