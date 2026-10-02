import { openingStatus, istWeekMinute } from '../../src/utils/openingHours.js';

// 2 Oct 2026 is a Friday. ist('2026-10-02T23:30') = that wall-clock time in Bhubaneswar.
const ist = (local) => new Date(`${local}:00+05:30`);

const lateNight = [{ day: 5, opensAt: '18:00', closesAt: '02:00' }]; // Fri 6 PM – Sat 2 AM
const twoShifts = [
  { day: 1, opensAt: '08:00', closesAt: '11:00' },
  { day: 1, opensAt: '17:00', closesAt: '22:00' },
]; // Monday
const satToSun = [{ day: 6, opensAt: '20:00', closesAt: '01:00' }]; // Sat 8 PM – Sun 1 AM

describe('openingStatus (IST)', () => {
  test('week minute uses IST', () => {
    expect(istWeekMinute(ist('2026-10-04T00:00'))).toBe(0); // Sunday 00:00
    expect(istWeekMinute(ist('2026-10-02T23:30'))).toBe(5 * 1440 + 23 * 60 + 30);
  });

  test('unknown when no hours', () => {
    expect(openingStatus([], ist('2026-10-02T12:00'))).toEqual({ state: 'unknown' });
  });

  test('after-midnight hours: open late Friday and early Saturday', () => {
    expect(openingStatus(lateNight, ist('2026-10-02T23:30'))).toMatchObject({ state: 'open', closesAt: '02:00', closingSoon: false });
    expect(openingStatus(lateNight, ist('2026-10-03T01:45'))).toMatchObject({ state: 'open', closingSoon: true });
    expect(openingStatus(lateNight, ist('2026-10-03T02:30')).state).toBe('closed');
    expect(openingStatus(lateNight, ist('2026-10-02T17:00'))).toMatchObject({ state: 'closed', opensAt: '18:00', opensToday: true });
  });

  test('two shifts on one day', () => {
    const monday = (t) => ist(`2026-10-05T${t}`);
    expect(openingStatus(twoShifts, monday('09:00')).state).toBe('open');
    expect(openingStatus(twoShifts, monday('12:00'))).toMatchObject({ state: 'closed', opensAt: '17:00', opensToday: true });
    expect(openingStatus(twoShifts, monday('18:00'))).toMatchObject({ state: 'open', closesAt: '22:00' });
    expect(openingStatus(twoShifts, monday('23:00'))).toMatchObject({ state: 'closed', opensAt: '08:00', opensDay: 1, opensToday: false });
  });

  test('Saturday night → Sunday morning wraps the week', () => {
    expect(openingStatus(satToSun, ist('2026-10-04T00:30')).state).toBe('open'); // Sunday 00:30
    expect(openingStatus(satToSun, ist('2026-10-04T01:30')).state).toBe('closed');
  });

  test('closing soon = within 30 minutes', () => {
    const r = [{ day: 5, opensAt: '10:00', closesAt: '22:00' }];
    expect(openingStatus(r, ist('2026-10-02T21:31')).closingSoon).toBe(true);
    expect(openingStatus(r, ist('2026-10-02T21:00')).closingSoon).toBe(false);
  });
});
