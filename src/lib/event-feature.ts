import { getUpcomingEvents, takeoverIsLive, type EventInput } from './events';
import type { ResolvedEvent } from '@/content/types';

/**
 * Which events the homepage leads with.
 *
 * Pure, and separated from the components, because "what should be on the
 * homepage" is a rule the restaurant cares about and a rule worth testing. The
 * components only lay out what this returns.
 */

export interface HomepageEvents {
  /** The single event running a hero takeover right now, if any. */
  takeover: ResolvedEvent | null;
  /** The dominant event in the featured module. */
  lead: ResolvedEvent | null;
  /** Two supporting events beside it. Never repeats the lead. */
  supporting: ResolvedEvent[];
  /** The soonest thing on, for the hero's NEXT UP line. */
  next: ResolvedEvent | null;
}

/** A cancelled night is never advertised; it stays visible only on /events. */
function advertisable(event: ResolvedEvent): boolean {
  return event.status !== 'cancelled' && event.status !== 'postponed';
}

/**
 * THE ORDER IS THE CALENDAR'S.
 *
 * The module reads soonest first, then the next two, and that is all. It used
 * to lead with whatever was most promoted, which put a featured event a month
 * out above the two nights happening this week — three cards in the order
 * October, September, September. A guest reads a row of events as a sequence
 * in time, and being wrong about that is worse than any promotion is worth.
 *
 * `featured` and `priority` survive as a tie-break between events starting at
 * the same moment, so two nights on one evening can still be ordered
 * deliberately. Promoting an event ABOVE the calendar is what a hero takeover
 * is for, and that has its own scheduled window.
 */
function sameTimeRank(event: ResolvedEvent): number {
  const { treatment, priority } = event.presentation;
  const base = treatment === 'featured' ? 1000 : 0;
  return base + Math.max(0, Math.min(99, priority));
}

export function selectHomepageEvents(input: EventInput, now: Date): HomepageEvents {
  const upcoming = getUpcomingEvents(input, now, 40).filter(advertisable);

  const takeover = upcoming.find((event) => takeoverIsLive(event, now)) ?? null;

  const chronological = [...upcoming].sort((a, b) => {
    const byDate = a.startsAt.localeCompare(b.startsAt);
    if (byDate !== 0) return byDate;
    return sameTimeRank(b) - sameTimeRank(a);
  });

  const lead = chronological[0] ?? null;
  const supporting = chronological.slice(1, 3);

  return {
    takeover,
    lead,
    supporting,
    // The same event as the lead now. Kept as its own field because "the next
    // thing on" is a different question from "what the module opens with", and
    // callers should not have to know they currently coincide.
    next: chronological[0] ?? null,
  };
}
