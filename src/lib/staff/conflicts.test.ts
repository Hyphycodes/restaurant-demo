import { describe, expect, it } from 'vitest';
import type { AvailabilityRule, Shift, TimeOffRequest } from '@/content/staff-types';
import { approvedTimeOffConflict, availabilityConflict, overlapConflict, scheduleWarnings, shiftsDuringTimeOff } from './conflicts';
import { zonedInstant } from './time';

const TZ = 'America/Chicago';

function shift(date: string, start: number, end: number, extra: Partial<Shift> = {}): Shift {
  const endDate = end <= start ? nextDay(date) : date;
  return {
    id: extra.id ?? `${date}-${start}`,
    locationId: 'l',
    employeeId: 'carlos',
    positionId: 'bartender',
    startsAt: zonedInstant(date, start, TZ),
    endsAt: zonedInstant(endDate, end, TZ),
    eventId: null,
    note: null,
    status: 'published',
    publishedAt: null,
    repeatGroupId: null,
    clockInAt: null,
    clockOutAt: null,
    breakMinutes: 0,
    attendanceStatus: 'not_tracked',
    attendanceNote: null,
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
}

function rule(weekday: number, available: boolean, start: number | null = null, end: number | null = null): AvailabilityRule {
  return { id: `r${weekday}`, employeeId: 'carlos', weekday, available, startMinutes: start, endMinutes: end, note: null };
}

function timeOff(startsOn: string, endsOn: string, status: TimeOffRequest['status'] = 'approved'): TimeOffRequest {
  return { id: 't', employeeId: 'carlos', employeeName: 'Carlos', startsOn, endsOn, reason: null, note: null, status, decidedAt: null, decisionNote: null, createdAt: '' };
}

// 2026-10-05 is a Monday, 2026-10-06 a Tuesday, 2026-10-10 a Saturday.
const base = { employeeName: 'Carlos', timezone: TZ, rules: [] as AvailabilityRule[], exceptions: [], timeOff: [] as TimeOffRequest[], otherShifts: [] as Shift[] };

describe('availability warnings', () => {
  it('warns when the weekday is marked unavailable', () => {
    const monday = shift('2026-10-05', 17 * 60, 23 * 60);
    const warning = availabilityConflict({ ...base, startsAt: monday.startsAt, endsAt: monday.endsAt, rules: [rule(1, false)] });
    expect(warning?.kind).toBe('unavailable');
    expect(warning?.message).toMatch(/Carlos marked themselves unavailable/);
  });

  it('warns when the shift starts before "available after 4 PM", and says it covers part of the shift', () => {
    const tuesday = shift('2026-10-06', 11 * 60, 18 * 60);
    const warning = availabilityConflict({ ...base, startsAt: tuesday.startsAt, endsAt: tuesday.endsAt, rules: [rule(2, true, 16 * 60, null)] });
    expect(warning?.message).toMatch(/only available after 4 PM/);
    expect(warning?.message).toMatch(/part of this shift/);
  });

  it('is quiet when the shift sits inside the window, including a close after midnight', () => {
    const saturday = shift('2026-10-10', 17 * 60, 2 * 60);
    expect(availabilityConflict({ ...base, startsAt: saturday.startsAt, endsAt: saturday.endsAt, rules: [rule(6, true, 17 * 60, null)] })).toBeNull();
  });

  it('a one-off exception beats the weekly rule', () => {
    const saturday = shift('2026-10-10', 17 * 60, 23 * 60);
    const warning = availabilityConflict({ ...base, startsAt: saturday.startsAt, endsAt: saturday.endsAt, rules: [rule(6, true)], exceptions: [{ id: 'e', employeeId: 'carlos', onDate: '2026-10-10', available: false, startMinutes: null, endMinutes: null, note: null }] });
    expect(warning?.message).toMatch(/unavailable that day/);
  });

  it('no rule means no preference, which is not a conflict', () => {
    const monday = shift('2026-10-05', 17 * 60, 23 * 60);
    expect(availabilityConflict({ ...base, startsAt: monday.startsAt, endsAt: monday.endsAt })).toBeNull();
  });
});

describe('time-off warnings', () => {
  it('approved time off on the shift day warns; pending or denied does not', () => {
    const monday = shift('2026-10-05', 17 * 60, 23 * 60);
    expect(approvedTimeOffConflict({ ...base, startsAt: monday.startsAt, endsAt: monday.endsAt, timeOff: [timeOff('2026-10-05', '2026-10-05')] })?.kind).toBe('time_off');
    expect(approvedTimeOffConflict({ ...base, startsAt: monday.startsAt, endsAt: monday.endsAt, timeOff: [timeOff('2026-10-05', '2026-10-05', 'pending')] })).toBeNull();
    expect(approvedTimeOffConflict({ ...base, startsAt: monday.startsAt, endsAt: monday.endsAt, timeOff: [timeOff('2026-10-05', '2026-10-05', 'denied')] })).toBeNull();
  });

  it('a shift that closes after midnight touches the next day too', () => {
    const saturday = shift('2026-10-10', 20 * 60, 2 * 60);
    expect(approvedTimeOffConflict({ ...base, startsAt: saturday.startsAt, endsAt: saturday.endsAt, timeOff: [timeOff('2026-10-11', '2026-10-12')] })).not.toBeNull();
  });

  it('finds the shifts inside a requested range so a manager sees what approval affects', () => {
    const shifts = [shift('2026-10-05', 17 * 60, 23 * 60), shift('2026-10-07', 17 * 60, 23 * 60), shift('2026-10-09', 17 * 60, 23 * 60)];
    expect(shiftsDuringTimeOff(shifts, '2026-10-06', '2026-10-08', TZ).map((entry) => entry.id)).toEqual(['2026-10-07-1020']);
  });
});

describe('overlap warnings', () => {
  it('warns when two shifts for the same person overlap, and ignores a cancelled one', () => {
    const first = shift('2026-10-05', 17 * 60, 23 * 60, { id: 'a' });
    const second = shift('2026-10-05', 21 * 60, 2 * 60, { id: 'b' });
    expect(overlapConflict({ ...base, startsAt: second.startsAt, endsAt: second.endsAt, otherShifts: [first] })?.kind).toBe('overlap');
    expect(overlapConflict({ ...base, startsAt: second.startsAt, endsAt: second.endsAt, otherShifts: [{ ...first, status: 'cancelled' }] })).toBeNull();
  });

  it('back-to-back shifts do not overlap', () => {
    const first = shift('2026-10-05', 11 * 60, 17 * 60);
    const second = shift('2026-10-05', 17 * 60, 23 * 60);
    expect(overlapConflict({ ...base, startsAt: second.startsAt, endsAt: second.endsAt, otherShifts: [first] })).toBeNull();
  });
});

describe('all warnings together', () => {
  it('lists time off first, then availability, then overlap — never blocks', () => {
    const monday = shift('2026-10-05', 17 * 60, 23 * 60);
    const warnings = scheduleWarnings({ ...base, startsAt: monday.startsAt, endsAt: monday.endsAt, rules: [rule(1, false)], timeOff: [timeOff('2026-10-05', '2026-10-05')], otherShifts: [shift('2026-10-05', 18 * 60, 20 * 60, { id: 'x' })] });
    expect(warnings.map((warning) => warning.kind)).toEqual(['time_off', 'unavailable', 'overlap']);
  });
});
