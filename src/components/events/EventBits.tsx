import type { ResolvedEvent } from '@/content/types';
import { formatPrice } from '@/lib/format';

/**
 * The small facts every event card repeats, in one place so the homepage and
 * the events page cannot start disagreeing about what "sold out" looks like.
 */

/** Sold out and free are words, never a colour alone. */
export function StatusChip({ event }: { event: ResolvedEvent }) {
  if (event.status === 'sold-out') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-(--radius-sm) border border-danger bg-danger/15 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-danger">
        Sold out
      </span>
    );
  }
  if (event.status === 'free') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-(--radius-sm) border border-success/60 bg-success/15 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-success">
        Free entry
      </span>
    );
  }
  if (event.status === 'postponed') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-(--radius-sm) border border-amber bg-amber/15 px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-amber">
        Postponed
      </span>
    );
  }
  return null;
}

/** What entry costs: the admin's own words first, then the number, then nothing. */
export function priceLabel(event: ResolvedEvent): string | null {
  if (event.presentation.priceText) return event.presentation.priceText;
  if (event.priceCents != null) return formatPrice(event.priceCents);
  return null;
}

/**
 * Where an event lives on this site.
 *
 * A standalone event has its own slug; a night of a recurring series belongs to
 * the series page. An event with neither falls back to the calendar rather than
 * linking nowhere.
 */
export function eventHref(event: ResolvedEvent): string {
  if (event.slug) return `/events/${event.slug}`;
  if (event.seriesSlug) return `/events/${event.seriesSlug}`;
  return '/events';
}
