import { getUpcomingEvents, ineligibleReason, venueIsoDate, type EventInput } from './events';
import type { ResolvedEvent } from '@/content/types';
import type { EventCategory } from '@/content/event-presentation';
import { CATEGORY_FILTERS } from '@/content/event-presentation';

/**
 * The shape of the events page.
 *
 * Pure, and separate from the page, because "which events are on, in what
 * order, under which month" is a rule the restaurant cares about — and because
 * a calendar that quietly drops or duplicates a night is the kind of bug that
 * is invisible in a screenshot and obvious to a guest standing at the door.
 */

export type CategoryFilter = EventCategory | 'all';

export interface EventMonth {
  /** `2026-10`. Venue-local, so a 1am event belongs to the night before. */
  key: string;
  label: string;
  /** October is the restaurant's biggest month and gets its own treatment. */
  isOctober: boolean;
  events: ResolvedEvent[];
}

export interface Calendar {
  /** The single event the page opens with. */
  lead: ResolvedEvent | null;
  /** The recurring nights that run underneath all of this, one entry each. */
  weekly: ResolvedEvent[];
  /**
   * Every event in date order, grouped by month — the lead included.
   *
   * It appears twice on the page, once as the banner and once in its month.
   * That is deliberate: dropping it leaves a hole in the calendar, and in the
   * common case where the lead is the only event in the restaurant's biggest
   * month, dropping it deletes that month's section entirely.
   */
  months: EventMonth[];
  /** How many events each filter would show. A chip that leads nowhere is not offered. */
  counts: Record<CategoryFilter, number>;
  /** Events matching the current filter, lead included. */
  total: number;
}

/** Consecutive months that share one treatment, in calendar order. */
export interface MonthRun {
  /** October's run is the loud one: a dark room and cards instead of rows. */
  october: boolean;
  months: EventMonth[];
}

/**
 * The months, in order, split into runs of the same treatment.
 *
 * October is the restaurant's biggest month and is shown louder than the rest.
 * The page used to get that by filtering October OUT of the calendar and
 * re-rendering it after every other month, which printed September, November,
 * then October — a calendar that does not run forwards is simply broken,
 * whatever it looks like.
 *
 * Runs keep both properties at once: the sequence is walked exactly once, so
 * the year always moves forwards, and each run carries the treatment its months
 * want. Consecutive ordinary months share a run so they can share one band
 * rather than each paying for a band's padding.
 */
export function groupMonthRuns(months: EventMonth[]): MonthRun[] {
  const runs: MonthRun[] = [];
  for (const month of months) {
    const last = runs[runs.length - 1];
    if (last && last.october === month.isOctober) last.months.push(month);
    else runs.push({ october: month.isOctober, months: [month] });
  }
  return runs;
}

const MONTH_NAME = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `2026-10` → `October 2026`. Built from the key rather than re-parsed, so it
 *  cannot disagree with the grouping it labels. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  const name = MONTH_NAME[Number(month) - 1];
  return name ? `${name} ${year}` : key;
}

/**
 * A tie-break between events starting at the same moment, nothing more.
 *
 * The page leads with whatever is SOONEST — the same order the homepage uses.
 * A banner headed "Next up" showing an event three weeks after the ones listed
 * under it is simply wrong, and that is what ranking by promotion produced.
 * See the note in event-feature.ts.
 */
function sameTimeRank(event: ResolvedEvent): number {
  const { treatment, priority } = event.presentation;
  const base = treatment === 'featured' ? 1000 : 0;
  return base + Math.max(0, Math.min(99, priority));
}

function matches(event: ResolvedEvent, filter: CategoryFilter): boolean {
  if (filter === 'all') return true;
  return event.presentation.category === filter;
}


export function buildCalendar(
  input: EventInput,
  now: Date,
  filter: CategoryFilter = 'all',
): Calendar {
  // A horizon rather than everything: recurring nights are generated from
  // cadence and would otherwise run forever, and publishing a year of dates
  // nobody has checked turns a calendar into a promise.
  const upcoming = getUpcomingEvents(input, now, 90).filter((event) => ineligibleReason(event, now) === null);

  // One entry per recurring series: its next night, which is the only date on
  // it anybody needs from this page.
  const weekly: ResolvedEvent[] = [];
  const seenSeries = new Set<string>();
  for (const event of upcoming) {
    if (!event.seriesSlug || seenSeries.has(event.seriesSlug)) continue;
    seenSeries.add(event.seriesSlug);
    weekly.push(event);
  }

  const special = upcoming.filter((event) => event.seriesSlug === null);

  const counts = { all: special.length } as Record<CategoryFilter, number>;
  for (const category of CATEGORY_FILTERS) {
    counts[category] = special.filter((event) => event.presentation.category === category).length;
  }

  const visible = special.filter((event) => matches(event, filter));

  const chronological = [...visible].sort((a, b) => {
    const byDate = a.startsAt.localeCompare(b.startsAt);
    if (byDate !== 0) return byDate;
    return sameTimeRank(b) - sameTimeRank(a);
  });
  const lead = chronological[0] ?? null;

  const months: EventMonth[] = [];
  for (const event of visible) {
    const key = venueIsoDate(event.startsAt).slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
    } else {
      months.push({ key, label: monthLabel(key), isOctober: key.endsWith('-10'), events: [event] });
    }
  }

  return { lead, weekly, months, counts, total: visible.length };
}
