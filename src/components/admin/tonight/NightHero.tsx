import { CountUp } from '@/components/admin/CountUp';
import { LinkButton } from '@/components/admin/ui';
import type { ResolvedEvent } from '@/content/types';
import { formatEventDateCompact, formatPrice, formatTimeRangeCompact } from '@/lib/format';
import type { SalesSummary } from '@/server/ticketing/sales';
import { ago } from './load';
import { FIGURE } from './parts';

/**
 * The night itself: tonight's event, or the next one when tonight is plain
 * dinner service. The only bold element on the screen.
 *
 * Attendance is the figure: tickets sold against the room, as a bar and a
 * number. A night that is free or sold elsewhere says so in words instead of
 * showing an empty bar.
 */
export function NightHero({
  event,
  eyebrow,
  summary,
  tiersKnown,
  ticketingOn,
  children,
}: {
  event: ResolvedEvent;
  eyebrow: string;
  summary: SalesSummary | null;
  tiersKnown: number | null;
  ticketingOn: boolean;
  /** Anything else about the night, e.g. a second event tonight. */
  children?: React.ReactNode;
}) {
  const inHouse = event.ticketing.enabled;
  const capacity = summary?.capacity ?? event.ticketing.capacity ?? null;
  const sold = summary?.ticketsSold ?? 0;
  const left = capacity !== null ? Math.max(0, capacity - (summary?.seatsTaken ?? 0)) : null;
  const percent = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
  const id = encodeURIComponent(event.overrideId ?? '');
  const editHref = event.overrideId ? `/admin/events/one/${id}` : event.seriesSlug ? `/admin/events/${event.seriesSlug}` : '/admin/events';
  const salesHref = `/admin/events/${id}/sales`;
  const free = event.priceCents === 0 || event.series?.ticketPolicy === 'free' || event.status === 'free';

  return (
    <section
      aria-labelledby="night-hero"
      className="admin-raised relative overflow-hidden rounded-(--radius-lg) border border-brown/12 bg-linen p-5 sm:p-7"
    >
      {/* Candlelight in one corner: the only decoration on the screen. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[radial-gradient(closest-side,rgb(232_163_61/0.16),transparent)]"
      />
      <p className="relative text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-coral">{eyebrow}</p>
      <div className="relative mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="night-hero" className="display min-w-0 text-[clamp(1.875rem,3.6vw,2.75rem)] leading-[0.95] text-brown">
          {event.title}
        </h2>
        <p className="tabular text-[1rem] text-brown-soft">{formatTimeRangeCompact(event.startsAt, event.endsAt)}</p>
      </div>
      {event.summary ? <p className="relative mt-3 max-w-[56ch] text-[0.9375rem] leading-relaxed text-brown-soft">{event.summary}</p> : null}

      {inHouse && summary ? (
        <div className="relative">
          <p className={`${FIGURE} mt-7 text-[clamp(2.25rem,5vw,3.25rem)] text-brown`}>
            <CountUp value={sold} />
            {capacity ? <span className="text-brown-soft"> of {capacity}</span> : null}
            <span className="ml-2 font-sans text-[1rem] font-semibold tracking-normal text-brown-soft">
              {capacity ? 'expected' : 'sold'}
            </span>
          </p>
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-brown/10"
            role="img"
            aria-label={capacity ? `${sold} of ${capacity} sold` : `${sold} sold`}
          >
            <div className="h-full rounded-full bg-amber" style={{ width: `${capacity ? percent : sold > 0 ? 100 : 0}%` }} />
          </div>
          <p className="tabular mt-3 text-[0.9375rem] text-brown-soft">
            {formatPrice(summary.netCents)} collected
            {left !== null ? ` · ${left} seats left` : ''}
            {summary.lastSaleAt ? ` · last sale ${ago(summary.lastSaleAt)}` : ' · no sales yet'}
            {summary.doorCents > 0 ? ` · ${formatPrice(summary.doorCents)} at the door` : ''}
          </p>
        </div>
      ) : (
        <p className="relative mt-6 text-[0.9375rem] leading-relaxed text-brown-soft">
          {inHouse
            ? !ticketingOn
              ? 'Ticket sales are not connected on this copy of the site.'
              : tiersKnown === 0
                ? 'Ticketing is on but nothing is priced yet.'
                : 'No sales yet.'
            : event.ticketUrl
              ? 'Tickets are sold on Tickeri, so sales are not counted here.'
              : free
                ? 'Free and walk-in. No tickets to count — just a room to fill.'
                : 'Not on sale.'}
        </p>
      )}

      <div className="relative mt-6 flex flex-wrap gap-2">
        {inHouse ? (
          <LinkButton href={salesHref} variant="primary">
            Open door list
          </LinkButton>
        ) : null}
        <LinkButton href={editHref} variant={inHouse ? 'secondary' : 'primary'}>
          Edit event
        </LinkButton>
        {inHouse ? (
          <LinkButton href={`/admin/door?event=${id}`} variant="secondary">
            Door
          </LinkButton>
        ) : null}
      </div>

      {children ? <div className="relative mt-6 border-t border-brown/10 pt-5">{children}</div> : null}
    </section>
  );
}

/** "Tonight", "Tomorrow", or "Sat Sep 26". */
export function whenLabel(event: ResolvedEvent, today: string, tomorrow: string, venueDate: (iso: string) => string): string {
  const date = venueDate(event.startsAt);
  if (date === today) return 'Tonight';
  if (date === tomorrow) return 'Tomorrow';
  return formatEventDateCompact(event.startsAt);
}
