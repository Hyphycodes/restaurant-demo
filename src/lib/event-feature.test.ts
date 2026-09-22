import { describe, expect, it } from 'vitest';
import { selectHomepageEvents } from './event-feature';
import type { EventInput, OccurrenceRecord } from './events';

const now = new Date('2026-09-11T12:00:00Z');

function event(
  id: string,
  date: string,
  presentation: Partial<OccurrenceRecord['presentation']> = {},
  extra: Partial<OccurrenceRecord> = {},
): OccurrenceRecord {
  return {
    id,
    seriesSlug: null,
    startsAt: `${date}T19:00:00-05:00`,
    endsAt: `${date}T23:00:00-05:00`,
    status: null,
    published: true,
    archivedAt: null,
    ticketUrl: 'https://example.invalid/demo',
    ticketLabel: null,
    priceCents: null,
    title: id,
    slug: id,
    summary: '',
    description: '',
    ageMin: null,
    ageNote: null,
    musicFormats: null,
    venueName: null,
    flyerAssetId: null,
    note: null,
    presentation: presentation as OccurrenceRecord['presentation'],
    provenance: null,
    ...extra,
  };
}

const input = (occurrences: OccurrenceRecord[]): EventInput => ({ series: [], occurrences });

/** A standalone event's resolved id is prefixed by the resolver. */
const at = (id: string) => `one-time:${id}`;

describe('selectHomepageEvents', () => {
  it('leads with the soonest event, not the most promoted one', () => {
    // A guest reads a row of events as a sequence in time. Leading with a
    // featured event a month out put October above two September nights, which
    // is what "the events are out of order" meant.
    const result = selectHomepageEvents(
      input([
        event('soon', '2026-09-12'),
        event('big', '2026-10-08', { treatment: 'featured', featured: true }),
      ]),
      now,
    );
    expect(result.lead?.id).toBe(at('soon'));
    expect(result.next?.id).toBe(at('soon'));
    expect(result.supporting.map((e) => e.id)).toEqual([at('big')]);
  });

  it('reports a live takeover without letting it jump the calendar', () => {
    // A takeover is promoted in the HERO, which is what it is for. The what's
    // on module underneath stays in date order like everything else.
    const result = selectHomepageEvents(
      input([
        event('featured', '2026-09-20', { treatment: 'featured', featured: true, priority: 90 }),
        event('takeover', '2026-10-31', {
          treatment: 'takeover',
          featured: true,
          takeoverStartAt: '2026-09-01T00:00:00Z',
          takeoverEndAt: '2026-11-01T00:00:00Z',
        }),
      ]),
      now,
    );
    expect(result.takeover?.id).toBe(at('takeover'));
    expect(result.lead?.id).toBe(at('featured'));
  });

  it('ignores a takeover whose window has not started or has ended', () => {
    const future = selectHomepageEvents(
      input([
        event('t', '2026-10-31', {
          treatment: 'takeover',
          takeoverStartAt: '2026-10-25T00:00:00Z',
          takeoverEndAt: '2026-11-01T00:00:00Z',
        }),
      ]),
      now,
    );
    expect(future.takeover).toBeNull();

    const past = selectHomepageEvents(
      input([
        event('t', '2026-09-30', {
          treatment: 'takeover',
          takeoverStartAt: '2026-08-01T00:00:00Z',
          takeoverEndAt: '2026-09-05T00:00:00Z',
        }),
      ]),
      now,
    );
    expect(past.takeover).toBeNull();
    // Still a perfectly good featured event; only the hero reverts.
    expect(past.lead?.id).toBe(at('t'));
  });

  it('never repeats the lead in the supporting slots, and shows at most two', () => {
    const result = selectHomepageEvents(
      input([
        event('a', '2026-09-12'),
        event('b', '2026-09-13'),
        event('c', '2026-09-14'),
        event('d', '2026-09-15'),
      ]),
      now,
    );
    expect(result.supporting).toHaveLength(2);
    expect(result.supporting.map((e) => e.id)).not.toContain(result.lead?.id);
  });

  it('never advertises a cancelled event anywhere', () => {
    const result = selectHomepageEvents(
      input([
        event('off', '2026-09-12', { treatment: 'featured' }, { status: 'cancelled' }),
        event('on', '2026-09-13'),
      ]),
      now,
    );
    expect(result.lead?.id).toBe(at('on'));
    expect(result.next?.id).toBe(at('on'));
    expect(result.supporting).toHaveLength(0);
  });

  it('uses priority only to separate events starting at the same moment', () => {
    const differentDays = selectHomepageEvents(
      input([
        event('later-important', '2026-09-25', { treatment: 'featured', priority: 50 }),
        event('sooner-ordinary', '2026-09-12', { treatment: 'featured', priority: 10 }),
      ]),
      now,
    );
    // Different days: the date decides, whatever the priority says.
    expect(differentDays.lead?.id).toBe(at('sooner-ordinary'));

    const sameNight = selectHomepageEvents(
      input([
        event('opener', '2026-09-12', { treatment: 'featured', priority: 10 }),
        event('headliner', '2026-09-12', { treatment: 'featured', priority: 50 }),
      ]),
      now,
    );
    // Same moment: priority is the tie-break, and the only thing it decides.
    expect(sameNight.lead?.id).toBe(at('headliner'));
  });

  it('copes with an empty calendar', () => {
    const result = selectHomepageEvents(input([]), now);
    expect(result).toEqual({ takeover: null, lead: null, supporting: [], next: null });
  });
});
