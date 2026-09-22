import { describe, expect, it } from 'vitest';
import { eventFromJsonLd, parseEventLinks, parseEvents, tickeriEventId } from './tickeri';
import { guessCategory } from './reconcile';

/**
 * Fixtures are shaped like the schema.org markup a ticketing page emits. The
 * point of these tests is the refusal cases: a parser that guesses a date is
 * worse than one that reports it could not read the page.
 */
const page = (payload: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(payload)}</script></head><body></body></html>`;

const listeningEvent = {
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: 'VINYL & VERMOUTH',
  url: 'https://www.tickeri.com/events/demo123/vinyl-vermouth',
  startDate: '2026-10-08T19:00:00-05:00',
  endDate: '2026-10-08T22:00:00-05:00',
  image: 'https://example.invalid/demo',
  description: 'Records, aperitivo and good company.',
  location: { '@type': 'Place', name: 'Cosa Nostra' },
  offers: [{ '@type': 'Offer', price: '45', availability: 'https://schema.org/InStock' }],
};

describe('tickeriEventId', () => {
  it('takes the id out of an event URL', () => {
    expect(tickeriEventId('https://www.tickeri.com/events/demo123/vinyl-vermouth')).toBe(
      'demo123',
    );
    expect(tickeriEventId('https://example.invalid/demo')).toBeNull();
  });
});

describe('eventFromJsonLd', () => {
  it('reads a complete event', () => {
    const event = eventFromJsonLd(listeningEvent);
    expect(event).toMatchObject({
      sourceEventId: 'demo123',
      title: 'VINYL & VERMOUTH',
      venueName: 'Cosa Nostra',
      flyerUrl: 'https://example.invalid/demo',
      priceText: '$45',
      soldOut: false,
      cancelled: false,
    });
    expect(event?.startsAt).toBe(new Date('2026-10-08T19:00:00-05:00').toISOString());
  });

  it('refuses an event with no date rather than inventing one', () => {
    expect(eventFromJsonLd({ ...listeningEvent, startDate: undefined })).toBeNull();
    expect(eventFromJsonLd({ ...listeningEvent, startDate: 'sometime in October' })).toBeNull();
  });

  it('refuses an event with no name or no usable URL', () => {
    expect(eventFromJsonLd({ ...listeningEvent, name: undefined })).toBeNull();
    expect(eventFromJsonLd({ ...listeningEvent, url: 'https://example.invalid/demo', '@id': undefined })).toBeNull();
  });

  it('reads sold out from the offers, and a range when tiers differ', () => {
    const soldOut = eventFromJsonLd({
      ...listeningEvent,
      offers: [{ price: '45', availability: 'https://schema.org/SoldOut' }],
    });
    expect(soldOut?.soldOut).toBe(true);

    const tiers = eventFromJsonLd({
      ...listeningEvent,
      offers: [{ price: '30', availability: 'InStock' }, { price: '55', availability: 'InStock' }],
    });
    expect(tiers?.priceText).toBe('$30–$55');
    // One tier still on sale means the event is not sold out.
    expect(tiers?.soldOut).toBe(false);
  });

  it('marks a cancelled event', () => {
    const off = eventFromJsonLd({ ...listeningEvent, eventStatus: 'https://schema.org/EventCancelled' });
    expect(off?.cancelled).toBe(true);
  });

  it('reports free entry as words', () => {
    const free = eventFromJsonLd({ ...listeningEvent, offers: [{ price: '0', availability: 'InStock' }] });
    expect(free?.priceText).toBe('Free');
  });
});

describe('parseEvents', () => {
  it('finds events nested in a @graph or an item list', () => {
    expect(parseEvents(page({ '@graph': [listeningEvent] }))).toHaveLength(1);
    expect(
      parseEvents(page({ '@type': 'ItemList', itemListElement: [{ item: listeningEvent }] })),
    ).toHaveLength(1);
  });

  it('survives a malformed block beside a good one', () => {
    const html = `<script type="application/ld+json">{not json}</script>${page(listeningEvent)}`;
    expect(parseEvents(html)).toHaveLength(1);
  });

  it('returns nothing for a page with no structured data', () => {
    expect(parseEvents('<html><body><h1>VINYL · Oct 8</h1></body></html>')).toEqual([]);
  });

  it('de-duplicates the same event listed twice', () => {
    expect(parseEvents(page([listeningEvent, listeningEvent]))).toHaveLength(1);
  });
});

describe('parseEventLinks', () => {
  it('collects unique absolute event links', () => {
    const html = `
      <a href="/events/aaa111/one">One</a>
      <a href="/events/aaa111/one">One again</a>
      <a href="/events/bbb222/two?ref=x">Two</a>
      <a href="/organizations/demo/fictional-events">Org</a>`;
    expect(parseEventLinks(html)).toEqual([
      'https://www.tickeri.com/events/aaa111/one',
      'https://www.tickeri.com/events/bbb222/two',
    ]);
  });
});

describe('guessCategory', () => {
  it('files the obvious ones and leaves the rest alone', () => {
    expect(guessCategory('VINYL & VERMOUTH')).toBe('vinyl-vermouth');
    expect(guessCategory('Vinyl & Vermouth Session')).toBe('vinyl-vermouth');
    expect(guessCategory('Comedy Show Hosted by Ruben')).toBe('comedy');
    expect(guessCategory('After Hours Friday')).toBe('nightlife');
    expect(guessCategory('Something Entirely New')).toBeNull();
  });
});
