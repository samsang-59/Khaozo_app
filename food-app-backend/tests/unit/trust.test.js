import { levelFor } from '../../src/services/helpers/trust.js';

const rules = { newAccountDays: 7, trustedMinScore: 2.0 };
const now = new Date('2026-10-02T12:00:00Z');
const daysAgo = (d) => new Date(now.getTime() - d * 86_400_000);

describe('trust level', () => {
  test('account younger than new_account_days is new (even with a high score)', () => {
    expect(levelFor({ createdAt: daysAgo(2), trustScore: 5 }, rules, now)).toBe('new');
  });

  test('older account with a normal score is normal', () => {
    expect(levelFor({ createdAt: daysAgo(30), trustScore: 1.0 }, rules, now)).toBe('normal');
  });

  test('older account at or above trusted_min_score is trusted', () => {
    expect(levelFor({ createdAt: daysAgo(30), trustScore: 2.0 }, rules, now)).toBe('trusted');
  });
});
