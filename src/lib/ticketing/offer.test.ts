import { describe, expect, it } from 'vitest';
import { estimateTotalCents, faceTotalCents, fromCents, isSoldOut, maxAddable, priceHeadline, scarcityLine, type OfferTier, type TicketOffer } from './offer';

const adult: OfferTier = { id: 'a', name: 'Adult', description: null, priceCents: 1000, seatsPerTicket: 1, minPerOrder: 0, maxPerOrder: 10, available: 30, onSale: true };
const kid: OfferTier = { id: 'k', name: 'Kid', description: null, priceCents: 600, seatsPerTicket: 1, minPerOrder: 0, maxPerOrder: 10, available: 30, onSale: true };

const noFees = { display: 'inclusive' as const, taxRateBps: 0, serviceFeeBps: 0, serviceFeeFlatCents: 0 };

function tiers(overrides: Partial<Extract<TicketOffer, { kind: 'tiers' }>> = {}): TicketOffer {
  return { kind: 'tiers', eventId: 'e', tiers: [adult, kid], remaining: 40, capacity: 40, fees: noFees, ...overrides };
}

describe('priceHeadline', () => {
  it('says From when tiers differ, and the single price when they do not', () => {
    expect(priceHeadline(tiers())).toBe('From $6');
    expect(priceHeadline(tiers({ tiers: [adult] }))).toBe('$10');
  });
  it('writes cents the way a guest says them', () => {
    expect(priceHeadline(tiers({ tiers: [{ ...adult, priceCents: 1250 }] }))).toBe('$12.50');
  });
  it('is honest about free events', () => {
    expect(priceHeadline({ kind: 'free' })).toBe('Free — just show up');
    expect(priceHeadline({ kind: 'door', priceCents: 0, priceText: null, soldOut: false })).toBe('Free — just show up');
  });
  it('falls back to the restaurant own words', () => {
    expect(priceHeadline({ kind: 'external', url: 'https://x', label: null, priceCents: null, priceText: '$25 · record included', soldOut: false })).toBe('$25 · record included');
  });
  it('is honest about a ticketed event with nothing priced yet', () => {
    expect(priceHeadline({ kind: 'pending' })).toBe('Tickets coming soon');
  });
});

describe('scarcityLine', () => {
  it('is silent while seats are plentiful', () => {
    expect(scarcityLine(tiers({ remaining: 30, capacity: 40 }))).toBeNull();
  });
  it('counts down under a quarter', () => {
    expect(scarcityLine(tiers({ remaining: 9, capacity: 40 }))).toBe('9 of 40 left');
  });
  it('says sold out at zero, including for external events', () => {
    expect(scarcityLine(tiers({ remaining: 0, capacity: 40 }))).toBe('Sold out');
    expect(scarcityLine({ kind: 'external', url: 'https://x', label: null, priceCents: null, priceText: null, soldOut: true })).toBe('Sold out');
  });
  it('never invents a number for an uncapped event', () => {
    expect(scarcityLine(tiers({ remaining: null, capacity: null }))).toBeNull();
  });
});

describe('isSoldOut', () => {
  it('is sold out when every on-sale tier is empty', () => {
    expect(isSoldOut(tiers({ tiers: [{ ...adult, available: 0 }, { ...kid, available: 0 }], remaining: 10 }))).toBe(true);
    expect(isSoldOut(tiers({ tiers: [{ ...adult, available: 0 }, kid] }))).toBe(false);
  });
  it('a pending offer is never sold out', () => {
    expect(isSoldOut({ kind: 'pending' })).toBe(false);
  });
});

describe('estimateTotalCents', () => {
  it('adds nothing when fees are inclusive, whatever they are set to', () => {
    expect(estimateTotalCents(1000, { display: 'inclusive', taxRateBps: 825, serviceFeeBps: 0, serviceFeeFlatCents: 100 })).toEqual({
      feeCents: 0,
      totalCents: 1000,
    });
  });
  it('adds a flat service fee on top, itemized', () => {
    expect(estimateTotalCents(1000, { display: 'itemized', taxRateBps: 0, serviceFeeBps: 0, serviceFeeFlatCents: 100 })).toEqual({
      feeCents: 100,
      totalCents: 1100,
    });
  });
  it('matches the server formula: percentage fee, then tax on fee-inclusive subtotal', () => {
    // face 1000, service 5% -> 50, tax 10% of (1000+50)=1050 -> 105, total 1155
    expect(estimateTotalCents(1000, { display: 'itemized', taxRateBps: 1000, serviceFeeBps: 500, serviceFeeFlatCents: 0 })).toEqual({
      feeCents: 155,
      totalCents: 1155,
    });
  });
});

describe('quantities', () => {
  it('totals face value only', () => {
    expect(faceTotalCents([adult, kid], { a: 2, k: 1 })).toBe(2600);
  });
  it('caps by tier, by order, and by the event', () => {
    expect(maxAddable(adult, 40)).toBe(10);
    expect(maxAddable({ ...adult, available: 3 }, 40)).toBe(3);
    expect(maxAddable({ ...adult, seatsPerTicket: 4, available: 10 }, 7)).toBe(1);
    expect(fromCents(tiers())).toBe(600);
  });
});
