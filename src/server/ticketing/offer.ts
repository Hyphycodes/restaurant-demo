import 'server-only';

import type { ResolvedEvent } from '@/content/types';
import type { TicketOffer } from '@/lib/ticketing/offer';
import { getEventAvailability } from './availability';

/**
 * The ticket offer for an event, as the public site sees it.
 *
 * An event with in-house ticketing on gets a `tiers` offer read from
 * `get_event_availability`; anything else is derived from the event itself:
 * sold through an outside link, free, or pay at the door. The page, the ticket
 * box, the sticky bar, the tiles and the JSON-LD all read the offer; none of
 * them computes a price or counts a seat.
 */

function fallbackOffer(event: ResolvedEvent): TicketOffer {
  const soldOut = event.status === 'sold-out';
  const free =
    event.status === 'free' ||
    event.priceCents === 0 ||
    event.series?.ticketPolicy === 'free';
  if (free) return { kind: 'free' };

  if (event.ticketUrl) {
    return {
      kind: 'external',
      url: event.ticketUrl,
      label: event.ticketLabel,
      priceCents: event.priceCents,
      priceText: event.presentation.priceText,
      soldOut,
    };
  }

  return { kind: 'door', priceCents: event.priceCents, priceText: event.presentation.priceText, soldOut };
}

export async function getTicketOffer(event: ResolvedEvent): Promise<TicketOffer> {
  if (event.ticketing.enabled) {
    // Casa Aurelia ticketing is the owner's explicit choice for this event. Once it's
    // on, an external `ticketUrl` never controls the public CTA again — not
    // even a stale one left over from before the switch, and not even while
    // availability is briefly unreachable or has no priced tiers yet. The
    // honest thing to show in that gap is `pending`, never someone else's link.
    if (event.overrideId) {
      const availability = await getEventAvailability(event.overrideId);
      if (availability && availability.tiers.length > 0) {
        return {
          kind: 'tiers',
          eventId: availability.eventId,
          tiers: availability.tiers.map(({ capacity: _capacity, taken: _taken, ...tier }) => tier),
          remaining: availability.available,
          capacity: availability.capacity,
          fees: {
            display: event.ticketing.feeDisplay,
            taxRateBps: event.ticketing.taxRateBps,
            serviceFeeBps: event.ticketing.serviceFeeBps,
            serviceFeeFlatCents: event.ticketing.serviceFeeFlatCents,
          },
        };
      }
    }
    return { kind: 'pending' };
  }
  return fallbackOffer(event);
}

/** Offers for a list, keyed by event id. One code path, however many events. */
export async function offersFor(events: ResolvedEvent[]): Promise<Map<string, TicketOffer>> {
  const offers = await Promise.all(events.map((event) => getTicketOffer(event)));
  return new Map(events.map((event, index) => [event.id, offers[index]!]));
}
