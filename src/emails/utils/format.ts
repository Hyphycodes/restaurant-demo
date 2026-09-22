/**
 * Date, time and money for emails.
 *
 * Re-exported from the website's own formatter so an email never disagrees
 * with the event page about what "7pm" means. Relative import on purpose:
 * `src/emails/**` is also compiled by the React Email preview server, which
 * does not know the `@/` alias.
 */
export {
  formatEventDateCompact,
  formatEventDateLong,
  formatEventTime,
  formatPrice,
  formatTimeRangeCompact,
} from '../../lib/format';

import { formatEventDateLong, formatEventTime, formatTimeRangeCompact } from '../../lib/format';

const TZ = 'America/Chicago';

/** "Saturday, October 18" — the long date without the year, for a heading. */
export function formatEventDateHeading(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ }).format(new Date(iso));
}

/** "Sat" / "18" / "Oct" — the pieces a date block sets in three sizes. */
export function dateParts(iso: string): { weekday: string; day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return { weekday: get('weekday'), day: get('day'), month: get('month'), year: get('year') };
}

/** "Doors 6:30pm · 7–10pm" or just the range. */
export function formatWhen(startsAt: string, endsAt: string, doorsAt: string | null): string {
  const range = formatTimeRangeCompact(startsAt, endsAt);
  return doorsAt ? `Doors ${formatEventTime(doorsAt).replace(':00', '')} · ${range}` : range;
}

/** "Saturday, October 18, 2026 · 7–10pm" — one line with everything. */
export function formatWhenLong(startsAt: string, endsAt: string): string {
  return `${formatEventDateLong(startsAt)} · ${formatTimeRangeCompact(startsAt, endsAt)}`;
}

/** "Oct 18, 2026 at 7:00pm" — for a refund receipt or a record. */
export function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })
    .format(new Date(iso))
    .replace(' AM', 'am')
    .replace(' PM', 'pm')
    .replace(', ', ', ')
    .replace(/(\d{4}), /, '$1 at ');
}

/** "Alessandro" from "Alessandro Costa", or null. */
export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
