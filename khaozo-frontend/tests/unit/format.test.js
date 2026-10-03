import { describe, expect, test } from 'vitest';
import { formatClock, formatDistance, formatPrice, openingText, sameHoursEveryDay, joinMeta, timeAgo } from '@/lib/format.js';

describe('format helpers', () => {
  test('prices and distances', () => {
    expect(formatPrice(220)).toBe('₹220');
    expect(formatPrice(1250)).toBe('₹1,250');
    expect(formatPrice(null)).toBeNull();
    expect(formatDistance(289)).toBe('290 m');
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(1234)).toBe('1.2 km');
    expect(formatDistance(15400)).toBe('15 km');
  });

  test('clock times (24 h → 12 h)', () => {
    expect(formatClock('11:00')).toBe('11 AM');
    expect(formatClock('23:30')).toBe('11:30 PM');
    expect(formatClock('00:15')).toBe('12:15 AM');
    expect(formatClock('12:00')).toBe('12 PM');
  });

  test('opening status text', () => {
    expect(openingText({ state: 'open', closesAt: '23:00', closingSoon: false })).toBe('Open till 11 PM');
    expect(openingText({ state: 'open', closesAt: '23:00', closingSoon: true })).toBe('Closes 11 PM');
    expect(openingText({ state: 'closed', opensAt: '11:00', opensDay: 6, opensToday: true })).toBe('Opens 11 AM');
    expect(openingText({ state: 'closed', opensAt: '11:00', opensDay: 1, opensToday: false })).toBe('Opens Mon 11 AM');
    expect(openingText({ state: 'unknown' })).toBeNull();
  });

  test('same hours every day', () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opensAt: '11:00', closesAt: '23:00' }));
    expect(sameHoursEveryDay(week)).toBe('11 AM – 11 PM');
    expect(sameHoursEveryDay(week.slice(1))).toBeNull();
  });

  test('joinMeta skips empty parts; timeAgo', () => {
    expect(joinMeta('a', null, '', 'b')).toBe('a · b');
    const now = Date.parse('2026-10-03T12:00:00Z');
    expect(timeAgo('2026-10-03T11:58:00Z', now)).toBe('2 min ago');
    expect(timeAgo('2026-10-01T12:00:00Z', now)).toBe('2 days ago');
  });
});
