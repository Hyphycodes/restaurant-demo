import { NextResponse, type NextRequest } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getTicketingClient } from '@/server/ticketing/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hygiene, every five minutes: expired pending orders become canceled, their
 * holds are released, and their PaymentIntents are canceled at Stripe so a
 * stale checkout tab cannot charge a card for seats that were given back.
 * Availability never depended on this running — an expired hold stops
 * counting the moment it expires — so a missed run costs nothing but tidiness.
 *
 * Vercel sends `Authorization: Bearer $CRON_SECRET`. With no secret set the
 * route refuses, so it cannot be hit by a stranger on a preview deployment.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const client = getTicketingClient();
  if (!client) return NextResponse.json({ ok: false, message: 'Ticketing is not configured.' }, { status: 503 });

  // Cancel the payment intents first, while the orders are still identifiable
  // as expired-and-pending. Best effort: one already confirmed will refuse,
  // and the webhook will pay that order regardless.
  const stripe = getStripe();
  let canceledIntents = 0;
  if (stripe) {
    const { data: expired } = await client
      .from('orders')
      .select('id, stripe_payment_intent_id')
      .eq('status', 'pending')
      .lte('expires_at', new Date().toISOString())
      .not('stripe_payment_intent_id', 'is', null)
      .limit(100);
    for (const order of expired ?? []) {
      try {
        await stripe.paymentIntents.cancel(String(order.stripe_payment_intent_id), { cancellation_reason: 'abandoned' });
        canceledIntents += 1;
      } catch {
        // Already succeeded, or already canceled. Either is fine.
      }
    }
  }

  const { data, error } = await client.rpc('release_expired_holds');
  if (error) {
    console.error('[cron] release_expired_holds failed:', error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, released: data ?? 0, canceledIntents });
}
