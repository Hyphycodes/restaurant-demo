import type { AvailabilityException, AvailabilityRule, ScheduleWarning, Shift, TimeOffRequest } from '@/content/staff-types';
import { formatClock, zonedDate, zonedMinutes, weekdayOf } from './time';

/**
 * What a manager should know before saving a shift.
 *
 * Nothing here prevents anything: the brief's rule is "show clear warnings,
 * let the manager override". The functions are pure so the rules are tested
 * in isolation, and the same rules run for a native client later.
 */

export interface ConflictInput {
  employeeName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  timeOff: TimeOffRequest[];
  /** The employee's other shifts, excluding the one being edited. */
  otherShifts: Shift[];
}

/** Every warning for this shift, in the order a manager should read them. */
export function scheduleWarnings(input: ConflictInput): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  const timeOff = approvedTimeOffConflict(input);
  if (timeOff) warnings.push(timeOff);
  const availability = availabilityConflict(input);
  if (availability) warnings.push(availability);
  const overlap = overlapConflict(input);
  if (overlap) warnings.push(overlap);
  return warnings;
}

/** Days the shift touches, in the venue's zone. A close after midnight touches two. */
function shiftDates(startsAt: string, endsAt: string, timezone: string): string[] {
  const first = zonedDate(startsAt, timezone);
  const last = zonedDate(new Date(new Date(endsAt).getTime() - 1), timezone);
  return first === last ? [first] : [first, last];
}

export function approvedTimeOffConflict(input: ConflictInput): ScheduleWarning | null {
  const dates = shiftDates(input.startsAt, input.endsAt, input.timezone);
  const hit = input.timeOff.find(
    (request) => request.status === 'approved' && dates.some((date) => date >= request.startsOn && date <= request.endsOn),
  );
  if (!hit) return null;
  return {
    kind: 'time_off',
    message: `${input.employeeName} has approved time off ${hit.startsOn === hit.endsOn ? 'that day' : `from ${hit.startsOn} to ${hit.endsOn}`}.`,
  };
}

/**
 * Availability is checked against the day the shift starts. An exception
 * for that date beats the weekly rule; no rule at all means "no
 * preference stated", which is not a conflict.
 */
export function availabilityConflict(input: ConflictInput): ScheduleWarning | null {
  const date = zonedDate(input.startsAt, input.timezone);
  const startMinutes = zonedMinutes(input.startsAt, input.timezone);
  const endDate = zonedDate(input.endsAt, input.timezone);
  // A shift that runs past midnight is "until close" for availability purposes.
  const endMinutes = endDate > date ? 1440 : zonedMinutes(input.endsAt, input.timezone);

  const exception = input.exceptions.find((entry) => entry.onDate === date);
  const window = exception
    ? { available: exception.available, start: exception.startMinutes, end: exception.endMinutes, source: 'that day' }
    : (() => {
        const rule = input.rules.find((entry) => entry.weekday === weekdayOf(date));
        return rule ? { available: rule.available, start: rule.startMinutes, end: rule.endMinutes, source: 'on that weekday' } : null;
      })();
  if (!window) return null;

  if (!window.available) {
    return { kind: 'unavailable', message: `${input.employeeName} marked themselves unavailable ${window.source}.` };
  }
  const from = window.start ?? 0;
  const to = window.end ?? 1440;
  if (startMinutes < from || endMinutes > to) {
    const partly = startMinutes < to && endMinutes > from;
    return {
      kind: 'unavailable',
      message: partly
        ? `${input.employeeName} is only available ${describeWindow(from, to)} ${window.source}, which covers part of this shift.`
        : `${input.employeeName} is only available ${describeWindow(from, to)} ${window.source}.`,
    };
  }
  return null;
}

function describeWindow(from: number, to: number): string {
  const clock = (minutes: number) => {
    const hour = Math.floor(minutes / 60) % 24;
    const minute = minutes % 60;
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return minute === 0 ? `${h12} ${hour < 12 ? 'AM' : 'PM'}` : `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  };
  if (from === 0 && to >= 1440) return 'all day';
  if (from === 0) return `until ${clock(to)}`;
  if (to >= 1440) return `after ${clock(from)}`;
  return `${clock(from)} to ${clock(to)}`;
}

export function overlapConflict(input: ConflictInput): ScheduleWarning | null {
  const start = Date.parse(input.startsAt);
  const end = Date.parse(input.endsAt);
  const hit = input.otherShifts.find(
    (shift) => shift.status !== 'cancelled' && Date.parse(shift.startsAt) < end && Date.parse(shift.endsAt) > start,
  );
  if (!hit) return null;
  return {
    kind: 'overlap',
    message: `${input.employeeName} already has a shift ${formatClock(hit.startsAt, input.timezone)} – ${formatClock(hit.endsAt, input.timezone)} that overlaps this one.`,
  };
}

/** Whether a date range of time off touches any of these shifts. */
export function shiftsDuringTimeOff(shifts: Shift[], startsOn: string, endsOn: string, timezone: string): Shift[] {
  return shifts.filter((shift) => {
    if (shift.status === 'cancelled') return false;
    const date = zonedDate(shift.startsAt, timezone);
    return date >= startsOn && date <= endsOn;
  });
}
