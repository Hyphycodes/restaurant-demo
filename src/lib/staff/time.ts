

const DAY_MS = 86_400_000;

export const WEEKDAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

/** Calendar parts of an instant in a zone. */
export function zonedParts(iso: string | Date, timezone: string): Parts {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: WEEKDAY_SHORT.indexOf(get('weekday') as (typeof WEEKDAY_SHORT)[number]),
  };
}

/** `YYYY-MM-DD` of an instant in a zone. */
export function zonedDate(iso: string | Date, timezone: string): string {
  const { year, month, day } = zonedParts(iso, timezone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Minutes after local midnight of an instant in a zone. */
export function zonedMinutes(iso: string | Date, timezone: string): number {
  const { hour, minute } = zonedParts(iso, timezone);
  return hour * 60 + minute;
}

/**
 * The instant at which a local wall-clock time happens in a zone.
 *
 * Done by measuring the zone's offset at a first guess and correcting once,
 * which is right on every day except the one an hour repeats, where it picks
 * the first. Good enough for a shift; nobody schedules the 1:30am that
 * happens twice.
 */
export function zonedInstant(date: string, minutes: number, timezone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, 0, 0) + minutes * 60_000;
  const offset = offsetMinutes(new Date(guess), timezone);
  let instant = guess - offset * 60_000;
  const check = offsetMinutes(new Date(instant), timezone);
  if (check !== offset) instant = guess - check * 60_000;
  return new Date(instant).toISOString();
}

function offsetMinutes(at: Date, timezone: string): number {
  const parts = zonedParts(at, timezone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** `YYYY-MM-DD` plus N days, as a calendar operation. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by!, bm! - 1, bd!) - Date.UTC(ay!, am! - 1, ad!)) / DAY_MS);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

/** The Monday-to-Sunday week containing a date, as seven dates. */
export function weekOf(date: string): string[] {
  const weekday = weekdayOf(date);
  const monday = addDays(date, weekday === 0 ? -6 : 1 - weekday);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function startOfWeek(date: string): string {
  return weekOf(date)[0]!;
}

/** "5:00 PM" or "5:30 PM", in a zone. Midnight is "12:00 AM". */
export function formatClock(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

/** "5 PM" when on the hour, "5:30 PM" otherwise. */
export function formatClockShort(iso: string, timezone: string): string {
  const { hour, minute } = zonedParts(iso, timezone);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? 'AM' : 'PM';
  return minute === 0 ? `${h12} ${suffix}` : `${h12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** "5 PM – Close" style range: end at or after 1am reads as "Close" when asked. */
export function formatShiftRange(startsAt: string, endsAt: string, timezone: string, options: { closeAfterMinutes?: number } = {}): string {
  const start = formatClockShort(startsAt, timezone);
  const endMinutes = zonedMinutes(endsAt, timezone);
  const startDate = zonedDate(startsAt, timezone);
  const endDate = zonedDate(endsAt, timezone);
  const late = endDate > startDate && options.closeAfterMinutes !== undefined && endMinutes <= options.closeAfterMinutes;
  return `${start} – ${late ? 'Close' : formatClockShort(endsAt, timezone)}`;
}

/** "Saturday, Oct 4" in a zone. */
export function formatDayLong(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** "Sat, Oct 4" */
export function formatDayShort(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** A `YYYY-MM-DD` as "Saturday, October 4". */
export function formatDate(date: string, style: 'long' | 'short' | 'numeric' = 'long'): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y!, m! - 1, d!, 12));
  if (style === 'numeric') return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric' }).format(at);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: style === 'long' ? 'long' : 'short',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
  }).format(at);
}

/** "Oct 4 – Oct 6", or just one date when they match. */
export function formatDateRange(from: string, to: string): string {
  if (from === to) return formatDate(from, 'short');
  return `${formatDate(from, 'short')} – ${formatDate(to, 'short')}`;
}

/** Minutes after midnight as "4:00 PM". */
export function formatMinutesOfDay(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** "9:30 PM" ← "21:30". */
export function minutesFromClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 24 || minute > 59) return null;
  return hour * 60 + minute;
}

export function clockFromMinutes(minutes: number | null): string {
  if (minutes === null) return '';
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "in 2 hours", "3 days ago" — for a list, never for a schedule. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const minutes = Math.round(diff / 60_000);
  const abs = Math.abs(minutes);
  const format = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  if (abs < 60) return format.format(minutes, 'minute');
  if (abs < 60 * 36) return format.format(Math.round(minutes / 60), 'hour');
  return format.format(Math.round(minutes / (60 * 24)), 'day');
}

export function greetingFor(hour: number): string {
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}
