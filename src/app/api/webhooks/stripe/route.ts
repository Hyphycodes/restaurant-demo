import { NextResponse, type NextRequest } from 'next/server';
import { getStripe, getWebhookSecret } from '@/lib/stripe';
import { getTicketingClient } from '@/server/ticketing/db';
import { alertOwner, sendOrderConfirmation, sendRefundConfirmation } from '@/server/ticketing/notify';
import { supabaseWebhookStore } from '@/server/ticketing/store';
import { handleStripeEvent } from '@/server/ticketing/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 *
 * The only place an order becomes paid. Raw body, verified signature, then
 * the event id is recorded — that insert is the idempotency guard, so a
 * replay returns 200 before touching an order. 400 only on a bad signature;
 * anything handled or ignored is 200, so Stripe stops retrying.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = getWebhookSecret();
  if (!stripe || !secret) return NextResponse.json({ ok: false, message: 'Webhook not configured.' }, { status: 503 });

  const signature = request.headers.get('stripe-signature');
  const body = await request.text();
  if (!signature) return NextResponse.json({ ok: false, message: 'Missing signature.' }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    console.error('[stripe] signature failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: 'Bad signature.' }, { status: 400 });
  }

  const client = getTicketingClient();
  if (!client) return NextResponse.json({ ok: false, message: 'Ticketing not configured.' }, { status: 503 });

  const guard = await client.from('processed_stripe_events').insert({ id: event.id, type: event.type });
  if (guard.error) {
    if (guard.error.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
    console.error('[stripe] could not record event:', guard.error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  try {
    const outcome = await handleStripeEvent(event, supabaseWebhookStore(client), {
      sendConfirmation: sendOrderConfirmation,
      sendRefundConfirmation,
      alertOwner,
      async refundInFull(paymentIntentId, reason) {
        // Idempotent on the payment intent: a retried webhook cannot refund twice.
        await stripe.refunds.create(
          { payment_intent: paymentIntentId, reason: 'requested_by_customer', metadata: { cn_reason: reason.slice(0, 190) } },
          { idempotencyKey: `oversold-${paymentIntentId}` },
        );
      },
    });
    return NextResponse.json({ ok: true, ...outcome });
  } catch (error) {
    // Let Stripe retry: the event row is removed so the retry is not treated
    // as a replay.
    console.error(`[stripe] ${event.type} failed:`, error instanceof Error ? error.message : error);
    await client.from('processed_stripe_events').delete().eq('id', event.id);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
