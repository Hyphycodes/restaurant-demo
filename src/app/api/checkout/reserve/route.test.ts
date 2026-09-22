import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

/**
 * The reserve endpoint, at the one fork a guest can feel: whether tapping
 * "Get tickets" hands them to the checkout page or leaves them on the event
 * page with an error.
 *
 * The seats and the money are exercised in SQL (see docs/ticketing.md →
 * "Reservation"); what is checked here is the shape of the answer the browser
 * navigates on.
 */

const context = vi.hoisted(() => ({
  stripeOn: true,
  reserved: {} as Record<string, unknown>,
  /** Every `orders` update the route performs, in order. */
  orderUpdates: [] as Record<string, unknown>[],
  intentsCreated: 0,
  /** Order ids a confirmation email was requested for. */
  confirmations: [] as string[],
}));

const chain = (table: string) => ({
  update(patch: Record<string, unknown>) {
    if (table === 'orders') context.orderUpdates.push(patch);
    return { eq: async () => ({ error: null }) };
  },
  select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { title: 'QA event' } }) }) }),
});

vi.mock('@/server/ticketing/db', () => ({
  getTicketingClient: () => ({
    rpc: async (name: string) =>
      name === 'reserve_order' ? { data: context.reserved, error: null } : { data: null, error: null },
    from: (table: string) => chain(table),
  }),
  RESERVE_ERRORS: {} as Record<string, string>,
  reserveErrorCode: () => null,
}));

vi.mock('@/server/ticketing/rate-limit', () => ({
  clientKey: () => 'test',
  overLimit: async () => false,
}));

vi.mock('@/server/ticketing/notify', () => ({
  sendOrderConfirmation: async (orderId: string) => {
    context.confirmations.push(orderId);
  },
}));
vi.mock('@/server/ticketing/availability', () => ({ getEventAvailability: async () => null }));
vi.mock('@/lib/ticketing/tokens', () => ({ signOrderToken: () => 'token' }));
vi.mock('@/lib/site-url', () => ({ absoluteUrl: (path: string) => `https://example.com${path}` }));

vi.mock('@/lib/stripe', () => ({
  isStripeConfigured: () => context.stripeOn,
  getStripe: () => ({
    paymentIntents: {
      create: async () => {
        context.intentsCreated += 1;
        return { id: 'pi_test', client_secret: 'cs_test' };
      },
    },
  }),
}));

import { POST } from './route';

const TIER = '11111111-1111-4111-8111-111111111111';

function request(): NextRequest {
  return {
    json: async () => ({ eventId: 'evt_1', items: [{ tierId: TIER, quantity: 1 }] }),
  } as unknown as NextRequest;
}

beforeEach(() => {
  context.stripeOn = true;
  context.orderUpdates = [];
  context.intentsCreated = 0;
  context.confirmations = [];
  context.reserved = {
    order_id: 'ord_1',
    order_number: 'CNS-QA123',
    event_id: 'evt_1',
    expires_at: new Date(Date.now() + 12 * 60_000).toISOString(),
    face_cents: 1000,
    subtotal_cents: 1000,
    service_fee_cents: 100,
    tax_cents: 0,
    discount_cents: 0,
    total_cents: 1100,
    items: [
      { tier_id: TIER, tier_name: 'General Admission', unit_price_cents: 1000, quantity: 1, seats: 1, subtotal_cents: 1000 },
    ],
  };
});

describe('POST /api/checkout/reserve', () => {
  it('hands the guest an order number and a payment to confirm', async () => {
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, orderNumber: 'CNS-QA123', clientSecret: 'cs_test' });
    expect(context.intentsCreated).toBe(1);
  });

  it('still sends the guest to checkout when card payments are not switched on', async () => {
    context.stripeOn = false;
    const response = await POST(request());
    const body = await response.json();
    // An order number is the whole contract: the ticket box and the expired-hold
    // retry both navigate to /events/<slug>/checkout?order=<it>.
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, orderNumber: 'CNS-QA123', payment: 'unavailable' });
    expect(body.clientSecret).toBeNull();
    // The hold stands, so the checkout page can show what is being bought and
    // the total to read out over the phone.
    expect(context.orderUpdates).toEqual([]);
    expect(context.intentsCreated).toBe(0);
  });

  it('fulfils a free order on the spot and asks for the ticket email once', async () => {
    context.reserved = { ...context.reserved, service_fee_cents: 0, discount_cents: 1000, total_cents: 0 };
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, orderNumber: 'CNS-QA123', paid: true });
    expect(body.ticketsUrl).toContain('/tickets/CNS-QA123?t=');
    // No card, so no PaymentIntent — and the same confirmation email a paid order gets.
    expect(context.intentsCreated).toBe(0);
    expect(context.confirmations).toEqual(['ord_1']);
  });

  it('cancels the order when the total is too small for a card', async () => {
    context.reserved = { ...context.reserved, total_cents: 25 };
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(context.orderUpdates).toEqual([{ status: 'canceled' }]);
  });
});
