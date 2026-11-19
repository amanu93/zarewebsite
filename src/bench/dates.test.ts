import { describe, expect, it } from 'vitest';

import {
  addDays,
  calendarDaysBetween,
  dateKey,
  daysFromToday,
  expiryLabel,
  formatDate,
  inDays,
  plural,
  startOfToday,
  timeAgo,
} from './dates';

// 17 Sept 2026, 09:00 EAT
const NOW = new Date('2026-09-17T06:00:00Z');

describe('calendar days in East Africa Time', () => {
  it('uses the EAT date, not the UTC date', () => {
    // 22:30 UTC on the 16th is already 01:30 on the 17th in Nairobi.
    expect(dateKey(new Date('2026-09-16T22:30:00Z'))).toBe('2026-09-17');
    expect(dateKey('2026-10-17')).toBe('2026-10-17');
  });

  it('counts 30 days to a date 30 days out, not 29', () => {
    expect(daysFromToday('2026-10-17', NOW)).toBe(30);
    // An expiry at 08:00 on 17 Oct, read at 09:00 on 17 Sept.
    expect(daysFromToday(new Date('2026-10-17T05:00:00Z'), NOW)).toBe(30);
  });

  it('counts days overdue by calendar date', () => {
    expect(daysFromToday('2026-09-07', NOW)).toBe(-10);
  });

  it('is 0 on the day of expiry, early or late in the day', () => {
    expect(daysFromToday(new Date('2026-09-17T20:59:00Z'), NOW)).toBe(0); // 23:59 EAT
    expect(daysFromToday(new Date('2026-09-16T21:00:00Z'), NOW)).toBe(0); // 00:00 EAT
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-09-17', 30)).toBe('2026-10-17');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(calendarDaysBetween('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('finds EAT midnight', () => {
    expect(startOfToday(NOW).toISOString()).toBe('2026-09-16T21:00:00.000Z');
  });
});

describe('labels', () => {
  it('uses relative labels under 30 days and the date after', () => {
    expect(timeAgo('2026-09-17T05:30:00Z', NOW)).toBe('30m ago');
    expect(timeAgo('2026-09-17T02:00:00Z', NOW)).toBe('4h ago');
    expect(timeAgo('2026-09-16T10:00:00Z', NOW)).toBe('yesterday');
    expect(timeAgo('2026-08-19T10:00:00Z', NOW)).toBe('29d ago');
    expect(timeAgo('2026-08-08T10:00:00Z', NOW)).toBe('8 Aug 2026');
  });

  it('phrases expiry and future dates', () => {
    expect(expiryLabel(0)).toBe('expires today');
    expect(expiryLabel(30)).toBe('30d left');
    expect(expiryLabel(-10)).toBe('10d overdue');
    expect(inDays('2026-09-18', NOW)).toBe('tomorrow');
    expect(inDays('2026-10-17', NOW)).toBe('in 30 days');
  });

  it('formats date-only values without shifting them', () => {
    expect(formatDate('2026-10-17')).toBe('17 Oct 2026');
  });

  it('pluralises', () => {
    expect(plural(1, 'call')).toBe('1 call');
    expect(plural(3, 'call')).toBe('3 calls');
    expect(plural(2, 'candidate needs', 'candidates need')).toBe('2 candidates need');
  });
});
