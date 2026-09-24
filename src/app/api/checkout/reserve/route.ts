import { sendOrderConfirmation } from '@/server/ticketing/notify';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import { signOrderToken } from '@/lib/ticketing/tokens';
import { absoluteUrl } from '@/lib/site-url';
import { getEventAvailability } from '@/server/ticketing/availability';
import { getTicketingClient, RESERVE_ERRORS, reserveErrorCode } from '@/server/ticketing/db';
import { clientKey, overLimit } from '@/server/ticketing/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/reserve
 *
 * The browser sends tier ids and quantities. Nothing else about money ever
 * crosses this boundary: `reserve_order` recomputes every cent from the
 * database, and the PaymentIntent is created from that result. The response
 * carries the client secret, the priced summary and the hold's expiry — never
 * the secret key and never the PaymentIntent object.
 */

const schema = z
  .object({
    eventId: z.string().min(1).max(120),
    items: z
      .array(z.object({ tierId: z.string().uuid(), quantity: z.number().int().min(1).max(50) }).strict())
      .min(1)
      .max(10),
    promoCode: z.string().trim().max(40).optional(),
  })
  .strict();

const HOLD_MINUTES = 12;

interface Reserved {
  order_id: string;
  order_number: string;
  event_id: string;
  expires_at: string;
  face_cents: number;
  subtotal_cents: number;
  service_fee_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  items: { tier_id: string; tier_name: string; unit_price_cents: number; quantity: number; seats: number; subtotal_cents: number }[];
}

function summaryOf(reserved: Reserved) {
  return {
    faceCents: reserved.face_cents,
    subtotalCents: reserved.subtotal_cents,
    serviceFeeCents: reserved.service_fee_cents,
    taxCents: reserved.tax_cents,
    discountCents: reserved.discount_cents,
    totalCents: reserved.total_cents,
    items: reserved.items.map((item) => ({
      tierId: item.tier_id,
      tierName: item.tier_name,
      unitPriceCents: item.unit_price_cents,
      quantity: item.quantity,
      subtotalCents: item.subtotal_cents,
    })),
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Choose at least one ticket.' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Choose at least one ticket.' }, { status: 400 });
  }

  const client = getTicketingClient();
  if (!client) {
    return NextResponse.json({ ok: false, message: 'Ticket sales are not open yet.' }, { status: 503 });
  }

  if (await overLimit(`reserve:${clientKey(request)}`, 10, 60)) {
    return NextResponse.json({ ok: false, message: 'Slow down a little. Try again in a minute.' }, { status: 429 });
  }

  const { eventId, items, promoCode } = parsed.data;
  const { data, error } = await client.rpc('reserve_order', {
    p_event_id: eventId,
    p_items: items.map((item) => ({ tier_id: item.tierId, quantity: item.quantity })),
    p_promo_code: promoCode ?? null,
    p_hold_minutes: HOLD_MINUTES,
    p_source: 'web',
  });

  if (error) {
    const code = reserveErrorCode(error.message) ?? 'UNKNOWN';
    const message = RESERVE_ERRORS[code] ?? 'Could not hold those seats just now. Try again in a moment.';
    // Sold out mid-decision: say so, and hand back what is actually left so
    // the ticket box can re-render without another round trip.
    const availability = /SOLD_OUT|CLOSED/.test(code) ? await getEventAvailability(eventId) : null;
    if (code === 'UNKNOWN') console.error('[reserve] failed:', error.message);
    return NextResponse.json({ ok: false, code, message, availability }, { status: code === 'UNKNOWN' ? 500 : 409 });
  }

  const reserved = data as Reserved;
  const summary = summaryOf(reserved);

  // Free after a promo: nothing to charge, so the order is paid and fulfilled
  // right here, through the same function the webhook uses.
  if (reserved.total_cents === 0) {
    const fulfilled = await client.rpc('fulfill_order', { p_order_id: reserved.order_id, p_charge_id: null, p_paid_at: new Date().toISOString() });
    if (fulfilled.error) {
      console.error('[reserve] free fulfil failed:', fulfilled.error.message);
      return NextResponse.json({ ok: false, message: 'Could not complete that just now. Try again in a moment.' }, { status: 500 });
    }
    // The same email a card payment gets from the webhook. Never allowed to
    // fail the order: a mailer problem is a log row, not a lost ticket.
    await sendOrderConfirmation(reserved.order_id).catch((error) => console.error('[reserve] confirmation email failed:', error));
    return NextResponse.json({
      ok: true,
      orderNumber: reserved.order_number,
      paid: true,
      ticketsUrl: absoluteUrl(`/tickets/${reserved.order_number}?t=${encodeURIComponent(signOrderToken(reserved.order_id))}`),
      summary,
      expiresAt: reserved.expires_at,
    });
  }

  // Card payments are not switched on yet. The hold still stands and the guest
  // still goes to the checkout page: the order number and the total are what
  // they read out over the phone, and that page says plainly that nothing was
  // charged. Cancelling here instead left them on the event page with an error
  // message and nowhere to go.
  if (!isStripeConfigured()) {
    return NextResponse.json({
      ok: true,
      orderNumber: reserved.order_number,
      clientSecret: null,
      payment: 'unavailable',
      summary,
      expiresAt: reserved.expires_at,
    });
  }

  if (reserved.total_cents < 50) {
    await client.from('orders').update({ status: 'canceled' }).eq('id', reserved.order_id);
    return NextResponse.json({ ok: false, message: 'Orders under $0.50 cannot be paid by card.' }, { status: 409 });
  }

  const stripe = getStripe()!;
  const { data: eventRow } = await client.from('event_occurrences').select('title').eq('id', eventId).maybeSingle();
  const eventName = String(eventRow?.title ?? 'Casa Aurelia event');

  let clientSecret: string | null = null;
  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: reserved.total_cents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          order_id: reserved.order_id,
          order_number: reserved.order_number,
          event_id: eventId,
          event_name: eventName.slice(0, 200),
        },
        description: `${eventName} — ${reserved.order_number}`.slice(0, 250),
        statement_descriptor_suffix: 'CASA AURELIA',
      },
      { idempotencyKey: reserved.order_id },
    );
    clientSecret = intent.client_secret;
    await client.from('orders').update({ stripe_payment_intent_id: intent.id }).eq('id', reserved.order_id);
  } catch (error) {
    console.error('[reserve] payment intent failed:', error instanceof Error ? error.message : error);
    await client.from('orders').update({ status: 'canceled' }).eq('id', reserved.order_id);
    return NextResponse.json({ ok: false, message: 'Could not start the payment. Nothing was charged. Try again in a moment.' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    orderNumber: reserved.order_number,
    clientSecret,
    summary,
    expiresAt: reserved.expires_at,
  });
}
