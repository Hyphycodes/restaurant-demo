import { describe, expect, it } from 'vitest';
import { buildCalendar, groupMonthRuns, monthLabel, type EventMonth } from './event-calendar';
import type { EventInput } from './events';
import { DEFAULT_PRESENTATION } from '@/content/types';
import type { EventCategory } from '@/content/event-presentation';
import type { EventStatus } from '@/content/types';
import type { OccurrenceRecord } from './events';

/** A standalone event on a given venue-local day. */
function event(
  slug: string,
  date: string,
  extra: {
    category?: EventCategory;
    featured?: boolean;
    priority?: number;
    status?: EventStatus;
  } = {},
): OccurrenceRecord {
  return {
    id: slug,
    seriesSlug: null,
    slug,
    startsAt: `${date}T19:00:00-05:00`,
    endsAt: `${date}T22:00:00-05:00`,
    status: extra.status ?? 'on-sale',
    published: true,
    archivedAt: null,
    ticketUrl: 'https://example.invalid/demo',
    ticketLabel: null,
    priceCents: 4500,
    title: slug,
    summary: '',
    description: '',
    ageMin: null,
    ageNote: null,
    musicFormats: [],
    venueName: 'Cosa Nostra',
    flyerAssetId: null,
    note: null,
    presentation: {
      ...DEFAULT_PRESENTATION,
      category: extra.category ?? 'vinyl-vermouth',
      featured: extra.featured ?? false,
      priority: extra.priority ?? 0,
      treatment: extra.featured ? 'featured' : 'standard',
    },
  } as unknown as OccurrenceRecord;
}

function input(occurrences: OccurrenceRecord[]): EventInput {
  return { series: [], occurrences };
}

const NOW = new Date('2026-09-01T12:00:00-05:00');

describe('monthLabel', () => {
  it('reads the label off the grouping key', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
    expect(monthLabel('2027-01')).toBe('January 2027');
  });
});

describe('buildCalendar', () => {
  it('groups in date order, one entry per month', () => {
    const calendar = buildCalendar(
      input([event('a', '2026-09-10'), event('b', '2026-09-24'), event('c', '2026-10-08')]),
      NOW,
    );
    expect(calendar.lead?.slug).toBe('a');
    expect(calendar.months.map((month) => month.key)).toEqual(['2026-09', '2026-10']);
    expect(calendar.months[0]!.events.map((e) => e.slug)).toEqual(['a', 'b']);
    expect(calendar.months[1]!.events.map((e) => e.slug)).toEqual(['c']);
  });

  it('marks October so the page can treat it differently', () => {
    const calendar = buildCalendar(
      input([event('a', '2026-09-10'), event('b', '2026-09-24'), event('c', '2026-10-08')]),
      NOW,
    );
    expect(calendar.months.find((month) => month.key === '2026-10')?.isOctober).toBe(true);
    expect(calendar.months.find((month) => month.key === '2026-09')?.isOctober).toBe(false);
  });

  it('keeps the lead in its own month, so the calendar has no hole in it', () => {
    // The lead leads the page AND still appears under its month. Dropping it
    // would delete a month's section when the lead is that month's only event.
    const calendar = buildCalendar(
      input([event('a', '2026-09-10'), event('b', '2026-10-08', { featured: true, priority: 10 })]),
      NOW,
    );
    expect(calendar.lead?.slug).toBe('a');
    expect(calendar.months.map((month) => month.key)).toEqual(['2026-09', '2026-10']);
    expect(calendar.months[0]!.events.map((e) => e.slug)).toEqual(['a']);
    expect(calendar.months[1]!.events.map((e) => e.slug)).toEqual(['b']);
  });

  it('leads with the soonest event, so "Next up" is never a later one', () => {
    const calendar = buildCalendar(
      input([
        event('october', '2026-10-08', { featured: true, priority: 10 }),
        event('september', '2026-09-10'),
      ]),
      NOW,
    );
    expect(calendar.lead?.slug).toBe('september');
  });

  it('counts every filter against the unfiltered calendar', () => {
    const calendar = buildCalendar(
      input([
        event('a', '2026-09-10', { category: 'vinyl-vermouth' }),
        event('b', '2026-09-11', { category: 'nightlife' }),
        event('c', '2026-09-12', { category: 'nightlife' }),
      ]),
      NOW,
    );
    expect(calendar.counts.all).toBe(3);
    expect(calendar.counts['nightlife']).toBe(2);
    expect(calendar.counts['vinyl-vermouth']).toBe(1);
    expect(calendar.counts['comedy']).toBe(0);
  });

  it('filters, and re-picks the lead inside the filter', () => {
    const calendar = buildCalendar(
      input([
        event('a', '2026-09-10', { category: 'vinyl-vermouth' }),
        event('b', '2026-09-11', { category: 'nightlife' }),
        event('c', '2026-09-12', { category: 'nightlife' }),
      ]),
      NOW,
      'nightlife',
    );
    expect(calendar.total).toBe(2);
    expect(calendar.lead?.slug).toBe('b');
    expect(calendar.months.flatMap((m) => m.events.map((e) => e.slug))).toEqual(['b', 'c']);
  });

  it('leaves out a cancelled night, as the rest of the site does', () => {
    // `ineligibleReason` is the one place that decides what is on. The calendar
    // does not get its own opinion, or a night could be off everywhere and
    // still on here. The event's own page still renders and says it is off.
    const calendar = buildCalendar(
      input([
        event('a', '2026-09-10'),
        event('b', '2026-09-24'),
        event('c', '2026-09-25', { status: 'cancelled' }),
      ]),
      NOW,
    );
    const listed = calendar.months.flatMap((month) => month.events.map((e) => e.slug));
    expect(listed).toEqual(['a', 'b']);
  });

  it('is empty, not broken, with nothing on', () => {
    const calendar = buildCalendar(input([]), NOW);
    expect(calendar.lead).toBeNull();
    expect(calendar.months).toEqual([]);
    expect(calendar.counts.all).toBe(0);
  });
});

describe('buildCalendar and recurring nights', () => {
  const series = {
    slug: 'after-hours-friday',
    title: 'After Hours Friday',
    description: 'House and Top 100.',
    cadence: { kind: 'weekly' as const, weekday: 5 },
    startMinutes: 22 * 60,
    endMinutes: 26 * 60,
    ageMin: 18,
    ageNote: null,
    musicFormats: ['House'],
    venueName: 'Cosa Nostra',
    flyerAssetId: null,
    flyerPrintedDate: null,
    priceCents: 1000,
    ticketUrlTemplate: null,
    paused: false,
    archivedAt: null,
  };

  it('lists a recurring night once, and keeps it out of the month calendar', () => {
    const calendar = buildCalendar(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { series: [series as any], occurrences: [event('a', '2026-09-10')] },
      NOW,
    );

    // Every Friday between now and the horizon would otherwise be a row.
    expect(calendar.weekly.map((e) => e.seriesSlug)).toEqual(['after-hours-friday']);
    // Only the standalone event is in the calendar; not one Friday.
    expect(calendar.months.flatMap((m) => m.events.map((e) => e.slug))).toEqual(['a']);
    expect(calendar.lead?.slug).toBe('a');
    expect(calendar.counts.all).toBe(1);
  });
});

describe('groupMonthRuns', () => {
  /** Only the fields the grouping actually reads. */
  function month(key: string): EventMonth {
    return { key, label: monthLabel(key), isOctober: key.endsWith('-10'), events: [] };
  }

  it('keeps the months in calendar order with October among them', () => {
    // THE BUG THIS EXISTS FOR: the page used to render every non-October month
    // and then October afterwards, which put September, November, October on
    // the screen in that order.
    const runs = groupMonthRuns([month('2026-09'), month('2026-10'), month('2026-11')]);

    expect(runs.flatMap((run) => run.months.map((m) => m.key))).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(runs.map((run) => run.october)).toEqual([false, true, false]);
  });

  it('gives consecutive ordinary months one run, so they share one band', () => {
    const runs = groupMonthRuns([month('2026-11'), month('2026-12'), month('2027-01')]);

    expect(runs).toHaveLength(1);
    expect(runs[0]!.october).toBe(false);
    expect(runs[0]!.months.map((m) => m.key)).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('opens with October when October is first', () => {
    const runs = groupMonthRuns([month('2026-10'), month('2026-11')]);

    expect(runs.map((run) => run.october)).toEqual([true, false]);
  });

  it('treats every year’s October as the loud one', () => {
    const runs = groupMonthRuns([month('2026-10'), month('2027-10')]);

    // Both are October, so they share a run — and the page renders one band
    // per month inside a run, so each still gets its own dark room.
    expect(runs).toHaveLength(1);
    expect(runs[0]!.october).toBe(true);
    expect(runs[0]!.months.map((m) => m.key)).toEqual(['2026-10', '2027-10']);
  });

  it('has nothing to group when the calendar is empty', () => {
    expect(groupMonthRuns([])).toEqual([]);
  });
});
