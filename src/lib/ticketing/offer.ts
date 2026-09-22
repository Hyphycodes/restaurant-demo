import { formatPrice } from '@/lib/format';

/**
 * What a guest can do about tickets for one event.
 *
 * Pure types and helpers, safe to import from a client island. The server
 * builds an offer in `src/server/ticketing/offer.ts` from the event and, once
 * ticketing is on, from `get_event_availability`; the ticket box only ever
 * renders what it is handed and never computes a price of its own.
 */

export interface OfferTier {
  id: string;
  name: string;
  description: string | null;
  /** Face value. Integer cents, never a float. */
  priceCents: number;
  /** Seats one ticket consumes. A "table of 4" is 4. */
  seatsPerTicket: number;
  minPerOrder: number;
  maxPerOrder: number;
  /** Seats still available on this tier, or null when unlimited. */
  available: number | null;
  /** Inside its sales window and active. */
  onSale: boolean;
}

/** How a face-value total becomes what the guest actually pays. Mirrors the server's `price_order`. */
export interface FeeConfig {
  display: 'inclusive' | 'itemized';
  taxRateBps: number;
  serviceFeeBps: number;
  serviceFeeFlatCents: number;
}

export type TicketOffer =
  /** Sold on this website. */
  | {
      kind: 'tiers';
      eventId: string;
      tiers: OfferTier[];
      /** Event-level seats remaining, or null when uncapped. */
      remaining: number | null;
      capacity: number | null;
      fees: FeeConfig;
    }
  
  | { kind: 'external'; url: string; label: string | null; priceCents: number | null; priceText: string | null; soldOut: boolean }
  /** No ticket needed. */
  | { kind: 'free' }
  /** Pay at the door, or not yet on sale. */
  | { kind: 'door'; priceCents: number | null; priceText: string | null; soldOut: boolean }
  
  | { kind: 'pending' };

/** The lowest on-sale face value, or the lowest at all when nothing is on sale. */
export function fromCents(offer: TicketOffer): number | null {
  if (offer.kind === 'tiers') {
    const prices = offer.tiers.filter((tier) => tier.onSale).map((tier) => tier.priceCents);
    const fallback = offer.tiers.map((tier) => tier.priceCents);
    const pool = prices.length ? prices : fallback;
    return pool.length ? Math.min(...pool) : null;
  }
  if (offer.kind === 'free') return 0;
  if (offer.kind === 'pending') return null;
  return offer.priceCents;
}

export function isSoldOut(offer: TicketOffer): boolean {
  if (offer.kind === 'tiers') {
    if (offer.remaining !== null && offer.remaining <= 0) return true;
    const sellable = offer.tiers.filter((tier) => tier.onSale);
    if (sellable.length === 0) return false;
    return sellable.every((tier) => tier.available !== null && tier.available <= 0);
  }
  if (offer.kind === 'free' || offer.kind === 'pending') return false;
  return offer.soldOut;
}

/**
 * The price a guest reads before deciding: "From $10", "$12.50", or the
 * restaurant's own words. Written the way a guest would say it.
 */
export function priceHeadline(offer: TicketOffer): string {
  if (offer.kind === 'free') return 'Free — just show up';
  if (offer.kind === 'pending') return 'Tickets coming soon';
  if (offer.kind === 'tiers') {
    const low = fromCents(offer);
    if (low === null) return 'Tickets';
    if (low === 0) return 'Free — just show up';
    const distinct = new Set(offer.tiers.map((tier) => tier.priceCents));
    return distinct.size > 1 ? `From ${formatPrice(low)}` : formatPrice(low);
  }
  if (offer.priceCents !== null) return offer.priceCents === 0 ? 'Free — just show up' : formatPrice(offer.priceCents);
  if (offer.priceText) return offer.priceText;
  return offer.kind === 'external' ? 'On sale now' : 'Pay at the door';
}

/**
 * The scarcity line, only when honest.
 *
 * "23 left" once under a quarter remains, "Sold out" at zero, and nothing at
 * all while seats are plentiful — a number on every event is noise, and a
 * fake one is worse.
 */
export function scarcityLine(offer: TicketOffer): string | null {
  if (offer.kind === 'pending') return null;
  if (isSoldOut(offer)) return 'Sold out';
  if (offer.kind !== 'tiers') return null;
  if (offer.remaining === null || offer.capacity === null || offer.capacity <= 0) return null;
  if (offer.remaining / offer.capacity < 0.25) {
    return `${offer.remaining} of ${offer.capacity} left`;
  }
  return null;
}

/** Face-value subtotal for an optimistic display. The server recomputes it. */
export function faceTotalCents(tiers: OfferTier[], quantities: Record<string, number>): number {
  return tiers.reduce((sum, tier) => sum + tier.priceCents * (quantities[tier.id] ?? 0), 0);
}

/**
 * What the guest will actually pay, before any promo code — same formula as
 * `price_order` in the database, so this preview never disagrees with the
 * real charge. `inclusive` fees are already baked into the sticker price, so
 * there is nothing to add; `itemized` fees are shown as their own line.
 */
export function estimateTotalCents(faceCents: number, fees: FeeConfig): { feeCents: number; totalCents: number } {
  if (fees.display !== 'itemized') return { feeCents: 0, totalCents: faceCents };
  const service = Math.round((faceCents * fees.serviceFeeBps) / 10000) + fees.serviceFeeFlatCents;
  const tax = Math.round(((faceCents + service) * fees.taxRateBps) / 10000);
  return { feeCents: service + tax, totalCents: faceCents + service + tax };
}

/** The most of one tier a guest may add right now. */
export function maxAddable(tier: OfferTier, remaining: number | null): number {
  const byTier = tier.available === null ? tier.maxPerOrder : Math.min(tier.maxPerOrder, Math.floor(tier.available / tier.seatsPerTicket));
  const byEvent = remaining === null ? byTier : Math.min(byTier, Math.floor(remaining / tier.seatsPerTicket));
  return Math.max(0, byEvent);
}
