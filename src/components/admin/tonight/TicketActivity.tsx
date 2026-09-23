import Link from 'next/link';
import type { ResolvedEvent } from '@/content/types';
import { formatEventDateCompact, formatPrice } from '@/lib/format';
import type { SalesSummary } from '@/server/ticketing/sales';
import { ago, type RecentOrder } from './load';
import { Eyebrow, FIGURE, Panel, Quiet, Section } from './parts';

/**
 * Tickets, in two lines and a short list: what this week has taken, and the
 * last few people who bought. Money is a fact here, not a chart.
 */
export function TicketActivity({
  weekCents,
  weekSold,
  weekEvents,
  orders,
  now,
}: {
  weekCents: number;
  weekSold: number;
  weekEvents: number;
  orders: RecentOrder[];
  now: Date;
}) {
  return (
    <Section id="tickets" title="Tickets" link={{ href: '/admin/events', label: 'All events' }}>
      <Panel>
        <div className="px-5 pt-5 pb-4 sm:px-6">
          <Eyebrow>Next seven days</Eyebrow>
          {weekEvents === 0 ? (
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-brown-soft">
              No ticketed nights in the next seven days. A quiet week for the door.
            </p>
          ) : (
            <>
              <p className={`${FIGURE} mt-2.5 text-[clamp(2rem,4vw,2.5rem)] text-brown`}>{formatMoney(weekCents)}</p>
              <p className="tabular mt-1.5 text-[0.875rem] text-brown-soft">
                {weekSold} {weekSold === 1 ? 'ticket' : 'tickets'} across {weekEvents} {weekEvents === 1 ? 'night' : 'nights'}
              </p>
            </>
          )}
        </div>
        {orders.length > 0 ? (
          <ul className="border-t border-brown/10">
            {orders.map((order) => (
              <li key={order.key} className="flex items-baseline gap-3 border-b border-brown/8 px-5 py-2.5 last:border-b-0 sm:px-6">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.875rem] font-semibold text-brown">{order.customer}</span>
                  <span className="block truncate text-[0.75rem] text-brown-soft">
                    {order.tickets} × {order.eventTitle}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block text-[0.875rem] text-brown">{formatPrice(order.totalCents)}</span>
                  <span className="tabular block text-[0.75rem] text-brown-soft">{ago(order.at, now.getTime())}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : weekEvents > 0 ? (
          <p className="border-t border-brown/10 px-5 py-3.5 text-[0.8125rem] text-brown-soft sm:px-6">
            No orders yet. The first one will show up here.
          </p>
        ) : null}
      </Panel>
    </Section>
  );
}

/** The next few nights, each with where its sales stand. */
export function ComingUp({ events, summaries }: { events: ResolvedEvent[]; summaries: Map<string, SalesSummary> }) {
  return (
    <Section id="coming-up" title="Coming up" link={{ href: '/admin/events', label: 'Calendar' }}>
      {events.length === 0 ? (
        <Quiet title="The calendar is clear after this.">
          <p>
            A flyer and a date is enough to start.{' '}
            <Link href="/admin/events/new" className="font-semibold text-brown underline underline-offset-4">
              Add an event
            </Link>
          </p>
        </Quiet>
      ) : (
        <ul className="divide-y divide-brown/10 border-y border-brown/10">
          {events.map((event) => {
            const summary = summaries.get(event.overrideId ?? '');
            const href = event.overrideId
              ? `/admin/events/one/${encodeURIComponent(event.overrideId)}`
              : `/admin/events/${event.seriesSlug ?? ''}`;
            return (
              <li key={event.id}>
                <Link href={href} className="group grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-3 text-[0.9375rem]">
                  <span className="tabular text-[0.8125rem] text-brown-soft">{formatEventDateCompact(event.startsAt).replace(/^\w+ /, '')}</span>
                  <span className="min-w-0 truncate font-semibold text-brown underline-offset-4 group-hover:underline">{event.title}</span>
                  <span className="tabular text-[0.8125rem] text-brown-soft">{soldLine(event, summary)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/** "$1,548": grouped, and cents only when there are some. */
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

export function soldLine(event: ResolvedEvent, summary: SalesSummary | undefined): string {
  if (!event.published) return 'draft';
  if (!event.ticketing.enabled) return event.ticketUrl ? 'on Tickeri' : event.priceCents === 0 ? 'walk-in' : 'not on sale';
  if (!summary) return 'not on sale yet';
  return summary.capacity ? `${summary.ticketsSold} of ${summary.capacity}` : `${summary.ticketsSold} sold`;
}
