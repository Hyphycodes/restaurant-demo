import { describe, expect, it } from 'vitest';
import { buildIcs, icsEscape } from './ics';

describe('buildIcs', () => {
  const ics = buildIcs(
    {
      uid: 'CNS-7K4M2@example.invalid',
      title: 'Aperitivo Club Fall Paint & Lunch',
      startsAt: '2026-09-19T17:00:00.000Z',
      endsAt: '2026-09-19T20:00:00.000Z',
      location: 'Casa Aurelia, West Loop, Chicago, IL ',
      description: 'Order CNS-7K4M2. Tickets: H7K4-M2Q9, PX2N-4R8T',
      url: 'https://example.com/tickets/CNS-7K4M2',
    },
    new Date('2026-09-18T00:00:00Z'),
  );

  it('carries the instants in UTC and a two-hour alarm', () => {
    expect(ics).toContain('DTSTART:20260919T170000Z');
    expect(ics).toContain('DTEND:20260919T200000Z');
    expect(ics).toContain('TRIGGER:-PT2H');
    expect(ics).toContain('END:VCALENDAR');
  });
  it('escapes commas in the address', () => {
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('LOCATION:Casa Aurelia\\, West Loop\\, Chicago\\, IL ');
    expect(icsEscape('a;b,c\nd')).toBe('a\;b\\,c\\nd');
  });
  it('folds long lines at 75 octets', () => {
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});
