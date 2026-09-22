import { describe, expect, it } from 'vitest';
import { isThemeActiveAt, themeStatusAt, venueLocalParts } from './schedule';

const base = { enabled: true, scheduleEnabled: false, startAt: null, endAt: null };

describe('themeStatusAt', () => {
  const now = new Date('2026-10-20T18:00:00Z');

  it('is off when not enabled, whatever the dates say', () => {
    expect(themeStatusAt({ ...base, enabled: false }, now)).toBe('off');
    expect(
      themeStatusAt(
        {
          enabled: false,
          scheduleEnabled: true,
          startAt: '2026-10-01T00:00:00Z',
          endAt: '2026-11-05T00:00:00Z',
        },
        now,
      ),
    ).toBe('off');
  });

  it('is live immediately when enabled without a schedule', () => {
    expect(themeStatusAt(base, now)).toBe('live');
    expect(isThemeActiveAt(base, now)).toBe(true);
  });

  it('honours the window when scheduled', () => {
    const scheduled = {
      ...base,
      scheduleEnabled: true,
      startAt: '2026-10-15T05:00:00Z',
      endAt: '2026-11-03T06:00:00Z',
    };
    expect(themeStatusAt(scheduled, new Date('2026-10-14T00:00:00Z'))).toBe('scheduled');
    expect(themeStatusAt(scheduled, new Date('2026-10-15T05:00:00Z'))).toBe('live');
    expect(themeStatusAt(scheduled, now)).toBe('live');
    expect(themeStatusAt(scheduled, new Date('2026-11-03T06:00:00Z'))).toBe('ended');
    expect(isThemeActiveAt(scheduled, new Date('2026-11-04T00:00:00Z'))).toBe(false);
  });

  it('treats a missing bound as open-ended', () => {
    expect(
      themeStatusAt({ ...base, scheduleEnabled: true, startAt: '2026-10-15T05:00:00Z' }, now),
    ).toBe('live');
    expect(
      themeStatusAt({ ...base, scheduleEnabled: true, endAt: '2026-10-19T05:00:00Z' }, now),
    ).toBe('ended');
    expect(themeStatusAt({ ...base, scheduleEnabled: true }, now)).toBe('live');
  });

  it('fails closed on a malformed date', () => {
    expect(themeStatusAt({ ...base, scheduleEnabled: true, startAt: 'soon' }, now)).toBe('off');
  });
});

describe('venueLocalParts', () => {
  it('renders an instant as Chicago wall-clock date and time', () => {
    // 2026-10-31 18:30 CDT is 23:30 UTC.
    const parts = venueLocalParts('2026-10-31T23:30:00Z', 'America/Chicago');
    expect(parts).toEqual({ date: '2026-10-31', time: '18:30' });
  });

  it('is empty for nothing or nonsense', () => {
    expect(venueLocalParts(null, 'America/Chicago')).toEqual({ date: '', time: '' });
    expect(venueLocalParts('later', 'America/Chicago')).toEqual({ date: '', time: '' });
  });
});
