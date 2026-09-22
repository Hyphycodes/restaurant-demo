import { DAY_NAMES } from '@/content/site';
import type { DayHours, TemporaryClosure, Weekday } from '@/content/types';
import { formatMinutes } from './format';

export interface HoursGroup {
  /** e.g. "Mon – Thu" or "Sunday" */
  label: string;
  /** e.g. "10am – 10pm" or "Closed" */
  value: string;
  days: Weekday[];
}

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0]; // Monday-first display

function rangeText(day: DayHours): string {
  if (day.closed || day.ranges.length === 0) return 'Closed';
  return day.ranges
    .map((r) => `${formatMinutes(r.openMinutes)} – ${formatMinutes(r.closeMinutes)}`)
    .join(', ');
}

/**
 * Collapses consecutive days with identical hours into a single row, so the
 * footer reads "Mon – Thu  10am – 10pm" rather than four identical lines.
 */
export function groupHours(hours: DayHours[]): HoursGroup[] {
  const byDay = new Map<Weekday, DayHours>(hours.map((h) => [h.day, h]));
  const groups: HoursGroup[] = [];

  for (const day of WEEK_ORDER) {
    const entry = byDay.get(day);
    if (!entry) continue;
    const value = rangeText(entry);
    const last = groups.at(-1);

    if (last && last.value === value) {
      last.days.push(day);
    } else {
      groups.push({ label: '', value, days: [day] });
    }
  }

  for (const group of groups) {
    const first = group.days[0];
    const final = group.days.at(-1);
    if (first === undefined || final === undefined) continue;
    group.label =
      group.days.length === 1
        ? DAY_NAMES[first]!
        : `${DAY_NAMES[first]!.slice(0, 3)} – ${DAY_NAMES[final]!.slice(0, 3)}`;
  }

  return groups;
}

export interface OpenState {
  open: boolean;
  /** Short human phrase, e.g. "Open until 10pm" or "Opens at 10am". */
  label: string;
  closureReason?: string;
}

/**
 * Determines open/closed for a given instant in the venue's timezone.
 *
 * Deliberately takes `now` as a parameter so it is testable, and so a server
 * render and a client hydration cannot disagree about "now".
 */
export function getOpenState(
  hours: DayHours[],
  closures: TemporaryClosure[],
  now: Date,
  timeZone = 'America/Chicago',
): OpenState {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayShort = get('weekday');
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayShort) as Weekday;
  const minutesNow = Number(get('hour')) * 60 + Number(get('minute'));
  const isoDate = `${get('year')}-${get('month')}-${get('day')}`;

  const closure = closures.find((c) => c.date === isoDate);
  if (closure) {
    return { open: false, label: 'Closed today', closureReason: closure.reason };
  }

  const byDay = new Map<Weekday, DayHours>(hours.map((h) => [h.day, h]));
  const today = byDay.get(dayIndex);

  // A range that closes after midnight belongs to yesterday's row.
  const yesterdayIndex = (((dayIndex - 1) % 7) + 7) % 7;
  const yesterday = byDay.get(yesterdayIndex as Weekday);
  if (yesterday) {
    for (const range of yesterday.ranges) {
      if (range.closeMinutes > 1440 && minutesNow < range.closeMinutes - 1440) {
        return { open: true, label: `Open until ${formatMinutes(range.closeMinutes)}` };
      }
    }
  }

  if (!today || today.closed || today.ranges.length === 0) {
    return { open: false, label: 'Closed today' };
  }

  for (const range of today.ranges) {
    if (minutesNow >= range.openMinutes && minutesNow < range.closeMinutes) {
      return { open: true, label: `Open until ${formatMinutes(range.closeMinutes)}` };
    }
  }

  const next = today.ranges.find((r) => r.openMinutes > minutesNow);
  if (next) return { open: false, label: `Opens at ${formatMinutes(next.openMinutes)}` };

  return { open: false, label: 'Closed for the night' };
}

/** schema.org openingHoursSpecification, built from the same source of truth. */
export function toSchemaHours(hours: DayHours[]) {
  const NAMES = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ] as const;

  const pad = (minutes: number) => {
    const normalized = minutes % 1440;
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
  };

  return hours.flatMap((day) =>
    day.closed
      ? []
      : day.ranges.map((range) => ({
          '@type': 'OpeningHoursSpecification' as const,
          dayOfWeek: `https://schema.org/${NAMES[day.day]}`,
          opens: pad(range.openMinutes),
          closes: pad(range.closeMinutes),
        })),
  );
}
