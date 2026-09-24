import Link from 'next/link';
import { EventArt, presetVars, type EventArtwork } from '@/components/events/EventArt';
import { eventHref, priceLabel } from '@/components/events/EventBits';
import { CATEGORY_LABEL } from '@/content/event-presentation';
import type { ResolvedEvent } from '@/content/types';
import { STATUS_LABEL } from '@/lib/events';
import { formatTimeRange } from '@/lib/format';

const TZ = 'America/Chicago';

export function dateParts(iso: string) {
  const date = new Date(iso);
  return {
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TZ }).format(date),
    day: new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: TZ }).format(date),
    month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: TZ }).format(date),
  };
}

/** One night in the listing: the date as a stamp, the title as the headline. */
export function EventRow({ event, art }: { event: ResolvedEvent; art: EventArtwork | undefined }) {
  const parts = dateParts(event.startsAt);
  const price = priceLabel(event);
  const status = STATUS_LABEL[event.status];
  const category = event.presentation.category;
  return (
    <li className="cn-erow" style={presetVars(event.presentation.visualPreset)}>
      <Link href={eventHref(event)} className="cn-erow-link">
        <span className="cn-erow-date cn-num">
          <small>{parts.weekday}</small>
          <b>{parts.day}</b>
          <small>{parts.month}</small>
        </span>
        <span className="cn-erow-main">
          <span className="cn-eyebrow">{category ? CATEGORY_LABEL[category] : 'At Casa Aurelia'}</span>
          <span className="cn-erow-title">{event.title}</span>
          {event.summary ? <span className="cn-erow-summary">{event.summary}</span> : null}
        </span>
        <span className="cn-erow-facts cn-num">
          <span>{formatTimeRange(event.startsAt, event.endsAt)}</span>
          <span>{price ?? (event.ticketing.enabled ? 'Ticketed' : 'Free entry')}</span>
          {status ? <span className="cn-chip" data-tone="wine">{status}</span> : event.ticketing.enabled ? <span className="cn-chip" data-tone="live">Tickets</span> : null}
        </span>
        <span className="cn-erow-go" aria-hidden="true">
          →
        </span>
        {art ? (
          <span className="cn-erow-peek" aria-hidden="true">
            <EventArt art={art} title={event.title} preset={event.presentation.visualPreset} size="card" sizes="220px" />
          </span>
        ) : null}
      </Link>
    </li>
  );
}
