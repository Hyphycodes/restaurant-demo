import { notFound } from 'next/navigation';
import { TicketBox } from '@/components/events/TicketBox';
import { Band, Frame } from '@/components/primitives/Band';
import type { TicketOffer } from '@/lib/ticketing/offer';

/**
 * Development only: the ticket box in every state, with made-up offers.
 *
 * In-house tiers need Supabase's functions, which the local file database
 * does not have, so this is how the stepper, the total and the scarcity line
 * get looked at on a phone before any money exists. 404 in production.
 */
export const dynamic = 'force-dynamic';

const TIERS: Extract<TicketOffer, { kind: 'tiers' }> = {
  kind: 'tiers',
  eventId: 'dev',
  remaining: 9,
  capacity: 40,
  fees: { display: 'itemized', taxRateBps: 0, serviceFeeBps: 0, serviceFeeFlatCents: 100 },
  tiers: [
    { id: 'a', name: 'Adult', description: 'Aperitivo and a shared antipasti course.', priceCents: 1000, seatsPerTicket: 1, minPerOrder: 0, maxPerOrder: 8, available: 9, onSale: true },
    { id: 'k', name: 'Kid (12 and under)', description: 'A smaller record and a juice.', priceCents: 600, seatsPerTicket: 1, minPerOrder: 0, maxPerOrder: 6, available: 9, onSale: true },
    { id: 't', name: 'Table of 4', description: 'Four seats together.', priceCents: 3600, seatsPerTicket: 4, minPerOrder: 0, maxPerOrder: 2, available: 8, onSale: true },
  ],
};

const OTHER_STATES: { label: string; offer: TicketOffer }[] = [
  {
    label: 'external (Tickeri-style)',
    offer: { kind: 'external', url: 'https://example.invalid/demo', label: 'Get tickets', priceCents: 1200, priceText: null, soldOut: false },
  },
  { label: 'free', offer: { kind: 'free' } },
  { label: 'door', offer: { kind: 'door', priceCents: 1000, priceText: null, soldOut: false } },
  {
    label: 'pending — Cosa Nostra ticketing on, nothing priced yet',
    offer: { kind: 'pending' },
  },
];

export default function DevTicketBoxPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Band surface="espresso" size="sm">
      <Frame>
        <div className="grid gap-8 lg:grid-cols-2">
          <TicketBox offer={TIERS} eventId="dev" eventSlug="dev" eventTitle="Dev event" />
          <TicketBox offer={{ ...TIERS, remaining: 0 }} eventId="dev" eventSlug="dev" eventTitle="Dev event" />
          {OTHER_STATES.map(({ label, offer }) => (
            <div key={label}>
              <p className="mb-2 text-[0.8125rem] font-semibold uppercase tracking-wide text-night-soft">{label}</p>
              <TicketBox offer={offer} eventId="dev" eventSlug="dev" eventTitle="Dev event" />
            </div>
          ))}
        </div>
      </Frame>
    </Band>
  );
}
