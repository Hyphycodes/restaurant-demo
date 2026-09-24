import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedEvent } from '@/content/types';
import { DEFAULT_DETAILS, DEFAULT_PRESENTATION, DEFAULT_TICKETING } from '@/content/types';
import type { EventAvailability } from './availability';

const { getEventAvailability } = vi.hoisted(() => ({ getEventAvailability: vi.fn() }));
vi.mock('./availability', () => ({ getEventAvailability }));

const { getTicketOffer } = await import('./offer');

function event(overrides: Partial<ResolvedEvent> = {}): ResolvedEvent {
  return {
    id: 'e1',
    overrideId: 'e1',
    seriesSlug: null,
    series: null,
    slug: 'test-event',
    startsAt: '2026-10-16T00:00:00.000Z',
    endsAt: '2026-10-16T03:00:00.000Z',
    status: 'scheduled',
    published: true,
    archivedAt: null,
    ticketUrl: null,
    ticketLabel: null,
    priceCents: 1000,
    title: 'Test Event',
    summary: '',
    description: '',
    ageMin: null,
    ageNote: null,
    musicFormats: [],
    venueName: 'Casa Aurelia',
    flyerAssetId: null,
    flyerPrintedDate: null,
    note: null,
    overriddenFields: [],
    presentation: { ...DEFAULT_PRESENTATION },
    provenance: { source: 'manual', sourceEventId: null, sourceUrl: null, syncedAt: null },
    ticketing: { ...DEFAULT_TICKETING },
    details: { ...DEFAULT_DETAILS },
    ...overrides,
  };
}

function availability(overrides: Partial<EventAvailability> = {}): EventAvailability {
  return { eventId: 'e1', ticketingEnabled: true, capacity: 40, taken: 0, available: 40, tiers: [], ...overrides };
}

describe('getTicketOffer', () => {
  beforeEach(() => {
    getEventAvailability.mockReset();
  });

  it('returns tiers when Casa Aurelia ticketing is on and priced', async () => {
    getEventAvailability.mockResolvedValueOnce(
      availability({
        tiers: [{ id: 't1', name: 'Adult', description: null, priceCents: 1000, seatsPerTicket: 1, minPerOrder: 0, maxPerOrder: 10, available: 40, onSale: true, capacity: 40, taken: 0 }],
      }),
    );
    const offer = await getTicketOffer(event({ ticketing: { ...DEFAULT_TICKETING, enabled: true } }));
    expect(offer.kind).toBe('tiers');
  });

  it('never falls back to the external URL once Casa Aurelia ticketing is enabled, even with a stale ticketUrl', async () => {
    getEventAvailability.mockResolvedValueOnce(availability({ tiers: [] }));
    const offer = await getTicketOffer(
      event({ ticketing: { ...DEFAULT_TICKETING, enabled: true }, ticketUrl: 'https://example.invalid/demo' }),
    );
    expect(offer.kind).toBe('pending');
  });

  it('is pending, not external or door, when availability is unreachable', async () => {
    getEventAvailability.mockResolvedValueOnce(null);
    const offer = await getTicketOffer(
      event({ ticketing: { ...DEFAULT_TICKETING, enabled: true }, ticketUrl: 'https://example.invalid/demo' }),
    );
    expect(offer.kind).toBe('pending');
  });

  it('uses the external link only when Casa Aurelia ticketing is off', async () => {
    const offer = await getTicketOffer(event({ ticketing: { ...DEFAULT_TICKETING, enabled: false }, ticketUrl: 'https://example.invalid/demo' }));
    expect(offer).toMatchObject({ kind: 'external', url: 'https://example.invalid/demo' });
    expect(getEventAvailability).not.toHaveBeenCalled();
  });
});
