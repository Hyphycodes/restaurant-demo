import type { ThemeRecord, ThemeStatus } from './types';

/**
 * When a saved theme is actually on the website.
 *
 * Pure, so it is unit-tested against every combination. The instants are ISO
 * strings; converting the admin's Chicago wall-clock entries into instants is
 * the admin action's job (see src/lib/events.ts → venueLocalIso), so this file
 * never has to know about time zones at all.
 */

type Window = Pick<ThemeRecord, 'enabled' | 'scheduleEnabled' | 'startAt' | 'endAt'>;

export function themeStatusAt(record: Window, now: Date): ThemeStatus {
  if (!record.enabled) return 'off';
  if (!record.scheduleEnabled) return 'live';

  const start = record.startAt ? Date.parse(record.startAt) : Number.NEGATIVE_INFINITY;
  const end = record.endAt ? Date.parse(record.endAt) : Number.POSITIVE_INFINITY;
  const at = now.getTime();

  // A malformed date must fail closed: the default look, not a stuck theme.
  if (Number.isNaN(start) || Number.isNaN(end)) return 'off';
  if (at < start) return 'scheduled';
  if (at >= end) return 'ended';
  return 'live';
}

export function isThemeActiveAt(record: Window, now: Date): boolean {
  return themeStatusAt(record, now) === 'live';
}

export const STATUS_LABEL: Record<ThemeStatus, string> = {
  off: 'Off',
  live: 'Live now',
  scheduled: 'Scheduled',
  ended: 'Dates have passed',
};

/**
 * An instant as the wall-clock date and time the restaurant would write down.
 * Used to fill the admin's date inputs from stored ISO values.
 */
export function venueLocalParts(
  iso: string | null,
  timeZone: string,
): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
  };
}

/** "Oct 15, 6:00 PM" in the restaurant's time zone, for status lines. */
export function formatVenueMoment(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);
}
