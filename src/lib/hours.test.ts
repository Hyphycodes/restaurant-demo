import { describe, expect, it } from 'vitest';
import { site } from '@/content/site';
import type { DayHours } from '@/content/types';
import { getOpenState, groupHours, toSchemaHours } from './hours';

const hours = site.hours.value;

describe('groupHours', () => {
  it('collapses consecutive identical days', () => {
    const groups = groupHours(hours);
    // Mon–Thu identical, Fri–Sat identical, Sunday alone.
    expect(groups).toHaveLength(3);
    expect(groups[0]?.label).toBe('Mon – Thu');
    expect(groups[1]?.label).toBe('Fri – Sat');
    expect(groups[2]?.label).toBe('Sunday');
  });

  it('renders a past-midnight close as a small-hours time', () => {
    const groups = groupHours(hours);
    expect(groups[1]?.value).toBe('4pm – 1am');
  });

  it('labels a closed day', () => {
    const withClosure: DayHours[] = hours.map((day) =>
      day.day === 1 ? { ...day, closed: true, ranges: [] } : day,
    );
    const groups = groupHours(withClosure);
    expect(groups.some((group) => group.value === 'Closed')).toBe(true);
  });

  it('handles a split day', () => {
    const split: DayHours[] = hours.map((day) =>
      day.day === 1
        ? {
            ...day,
            ranges: [
              { openMinutes: 660, closeMinutes: 720 },
              { openMinutes: 960, closeMinutes: 1320 },
            ],
          }
        : day,
    );
    const groups = groupHours(split);
    expect(groups.some((group) => group.value.includes(','))).toBe(true);
  });
});

describe('getOpenState', () => {
  const noClosures: never[] = [];

  it('is open during service', () => {
    // Thursday 2pm Chicago.
    const state = getOpenState(hours, noClosures, new Date('2026-08-13T23:00:00Z'));
    expect(state.open).toBe(true);
    expect(state.label).toBe('Open until 11pm');
  });

  it('is closed before opening, and says when it opens', () => {
    // Thursday 8am Chicago.
    const state = getOpenState(hours, noClosures, new Date('2026-08-13T13:00:00Z'));
    expect(state.open).toBe(false);
    expect(state.label).toBe('Opens at 4pm');
  });

  it('is still open after midnight on a late night', () => {
    // Saturday 12:30am Chicago — inside Friday's 10am–1am range.
    const state = getOpenState(hours, noClosures, new Date('2026-08-15T05:30:00Z'));
    expect(state.open).toBe(true);
    expect(state.label).toBe('Open until 1am');
  });

  it('is closed after the late-night close', () => {
    // Saturday 3am Chicago — Friday's 1am close has passed.
    const state = getOpenState(hours, noClosures, new Date('2026-08-15T08:00:00Z'));
    expect(state.open).toBe(false);
  });

  it('respects a temporary closure', () => {
    const state = getOpenState(
      hours,
      [{ id: 'x', date: '2026-08-13', reason: 'Private event', allDay: true }],
      new Date('2026-08-13T23:00:00Z'),
    );
    expect(state.open).toBe(false);
    expect(state.closureReason).toBe('Private event');
  });
});

describe('toSchemaHours', () => {
  it('emits one specification per range', () => {
    expect(toSchemaHours(hours)).toHaveLength(7);
  });

  it('formats times as HH:MM and wraps past-midnight closes', () => {
    const schema = toSchemaHours(hours);
    for (const entry of schema) {
      expect(entry.opens).toMatch(/^\d{2}:\d{2}$/);
      expect(entry.closes).toMatch(/^\d{2}:\d{2}$/);
    }
    const friday = schema.find((entry) => entry.dayOfWeek.endsWith('Friday'));
    // 1500 minutes -> 01:00 the next day.
    expect(friday?.closes).toBe('01:00');
  });

  it('omits closed days entirely', () => {
    const withClosure: DayHours[] = hours.map((day) =>
      day.day === 1 ? { ...day, closed: true, ranges: [] } : day,
    );
    expect(toSchemaHours(withClosure)).toHaveLength(6);
  });
});
