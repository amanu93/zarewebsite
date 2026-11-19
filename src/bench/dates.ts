/**
 * Dates for the portal, in one place.
 *
 * Everything a recruiter reads is in calendar days in East Africa Time, not
 * in 24-hour periods: "Good until 17 Oct" read on 17 Sept is 30 days away,
 * and something that expired on 7 Sept is 10 days overdue on the 17th, however
 * many hours have passed. Every day count, "x ago" and date label in the
 * portal comes from these functions. Do not compute days anywhere else.
 *
 * Date-only values (recall dates, earliest start, request deadlines) are
 * stored as "YYYY-MM-DD" and are already calendar dates in EAT; timestamps
 * (calls, verifications) are ISO instants and are converted.
 */

export const TIME_ZONE = 'Africa/Nairobi';

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The EAT calendar date of a timestamp or date-only value, as YYYY-MM-DD. */
export function dateKey(value: string | Date): string {
  if (typeof value === 'string' && DATE_ONLY.test(value)) return value;
  return keyFormatter.format(typeof value === 'string' ? new Date(value) : value);
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

const keyToUtc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole calendar days from `from` to `to`. Negative when `to` is earlier. */
export function calendarDaysBetween(from: string | Date, to: string | Date): number {
  return Math.round((keyToUtc(dateKey(to)) - keyToUtc(dateKey(from))) / DAY_MS);
}

/** Calendar days from today until `value`: 0 today, 1 tomorrow, -1 yesterday. */
export function daysFromToday(value: string | Date | null, now: Date = new Date()): number | null {
  if (value === null) return null;
  return calendarDaysBetween(now, value);
}

/** A calendar date `days` after a date-only key. */
export function addDays(key: string, days: number): string {
  return new Date(keyToUtc(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The instant EAT midnight starts on the calendar date of `now`. */
export function startOfToday(now: Date = new Date()): Date {
  // EAT is UTC+3 with no daylight saving.
  return new Date(keyToUtc(dateKey(now)) - 3 * 3_600_000);
}

// ---------------------------------------------------------------- labels ----

export function plural(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : (many ?? `${one}s`)}`;
}

const dayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dayFormatterLong = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateOnlyAsInstant = (key: string) => new Date(`${key}T12:00:00+03:00`);

/** "17 Oct 2026". */
export function formatDate(value: string | null): string {
  if (!value) return '—';
  return dayFormatter.format(DATE_ONLY.test(value) ? dateOnlyAsInstant(value) : new Date(value));
}

const shortFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' });
const weekdayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** "Sat 17 Oct", or "17 Oct" without the weekday. For emails and tight columns. */
export function formatShortDate(value: string | Date, withWeekday = true): string {
  const d = typeof value === 'string' && DATE_ONLY.test(value) ? dateOnlyAsInstant(value) : new Date(value);
  return (withWeekday ? weekdayFormatter : shortFormatter).format(d);
}

/** "17 October 2026". */
export function formatDateLong(value: string | null): string {
  if (!value) return '—';
  return dayFormatterLong.format(DATE_ONLY.test(value) ? dateOnlyAsInstant(value) : new Date(value));
}

/** How many days count as "recent" enough for a relative label. */
export const RELATIVE_LIMIT_DAYS = 30;

/**
 * A past moment, one format per range: minutes and hours today, then calendar
 * days ("yesterday", "3d ago") under 30 days, then the date itself. A value
 * is only ever shown one way, never as a date and a relative label at once.
 */
export function timeAgo(value: string | null, now: Date = new Date()): string {
  if (!value) return '—';
  const days = calendarDaysBetween(value, now);
  if (days <= 0) {
    const mins = Math.floor((now.getTime() - new Date(value).getTime()) / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
  if (days === 1) return 'yesterday';
  if (days < RELATIVE_LIMIT_DAYS) return `${days}d ago`;
  return formatDate(value);
}

/** Days until an expiry, as the queue and directory phrase it. */
export function expiryLabel(daysLeft: number | null): string {
  if (daysLeft === null) return 'never verified';
  if (daysLeft === 0) return 'expires today';
  if (daysLeft > 0) return `${daysLeft}d left`;
  return `${Math.abs(daysLeft)}d overdue`;
}

/** A future date phrased from today: "today", "tomorrow", "in 12 days". */
export function inDays(value: string | null, now: Date = new Date()): string {
  const d = daysFromToday(value, now);
  if (d === null) return '—';
  if (d < 0) return `${Math.abs(d)}d ago`;
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  return `in ${d} days`;
}
