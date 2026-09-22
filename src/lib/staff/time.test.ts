import { describe, expect, it } from 'vitest';
import { addDays, formatClockShort, formatShiftRange, minutesFromClock, weekOf, zonedDate, zonedInstant, zonedMinutes } from './time';

const TZ = 'America/Chicago';

describe('zoned time', () => {
  it('turns a Chicago wall-clock time into the right instant across the DST change', () => {
    // CDT (UTC-5) in October, CST (UTC-6) in December.
    expect(zonedInstant('2026-10-10', 17 * 60, TZ)).toBe('2026-10-10T22:00:00.000Z');
    expect(zonedInstant('2026-12-12', 17 * 60, TZ)).toBe('2026-12-12T23:00:00.000Z');
  });

  it('round-trips date and minutes', () => {
    const instant = zonedInstant('2026-10-10', 20 * 60 + 30, TZ);
    expect(zonedDate(instant, TZ)).toBe('2026-10-10');
    expect(zonedMinutes(instant, TZ)).toBe(20 * 60 + 30);
  });

  it('a shift ending at 2:30 AM is on the next calendar day but reads as one shift', () => {
    const start = zonedInstant('2026-10-10', 20 * 60 + 30, TZ);
    const end = zonedInstant('2026-10-11', 2 * 60 + 30, TZ);
    expect(formatShiftRange(start, end, TZ)).toBe('8:30 PM – 2:30 AM');
    expect(formatShiftRange(start, end, TZ, { closeAfterMinutes: 4 * 60 })).toBe('8:30 PM – Close');
  });

  it('formats clocks the way a schedule reads', () => {
    expect(formatClockShort(zonedInstant('2026-10-10', 17 * 60, TZ), TZ)).toBe('5 PM');
    expect(formatClockShort(zonedInstant('2026-10-10', 0, TZ), TZ)).toBe('12 AM');
    expect(formatClockShort(zonedInstant('2026-10-10', 11 * 60 + 15, TZ), TZ)).toBe('11:15 AM');
  });
});

describe('calendar helpers', () => {
  it('weeks run Monday to Sunday', () => {
    expect(weekOf('2026-10-10')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(weekOf('2026-10-11')[0]).toBe('2026-10-05');
    expect(weekOf('2026-10-12')[0]).toBe('2026-10-12');
  });

  it('adds days across a month boundary', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('parses a form clock and rejects nonsense', () => {
    expect(minutesFromClock('17:30')).toBe(17 * 60 + 30);
    expect(minutesFromClock('9:05')).toBe(9 * 60 + 5);
    expect(minutesFromClock('25:00')).toBeNull();
    expect(minutesFromClock('five')).toBeNull();
  });
});
