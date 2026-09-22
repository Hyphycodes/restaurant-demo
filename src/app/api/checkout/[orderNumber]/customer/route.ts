import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getStripe } from '@/lib/stripe';
import { getTicketingClient } from '@/server/ticketing/db';
import { getOrderByNumber, holdIsLive } from '@/server/ticketing/orders';
import { clientKey, overLimit } from '@/server/ticketing/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/[orderNumber]/customer
 *
 * Who is buying, and what they agreed to. Written just before the payment is
 * confirmed, so the ticket email has somewhere to go and the refund policy the
 * guest saw is on the order as evidence. Only a live pending order accepts it.
 */
const schema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(180),
    phone: z.string().trim().max(32).optional().or(z.literal('')),
    consentText: z.string().trim().min(10).max(2000),
  })
  .strict();

export async function POST(request: NextRequest, context: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: 'Enter your name and email.' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Enter your name and an email we can send the tickets to.' }, { status: 400 });
  }
  if (await overLimit(`customer:${clientKey(request)}`, 30, 60)) {
    return NextResponse.json({ ok: false, message: 'Try again in a minute.' }, { status: 429 });
  }

  const client = getTicketingClient();
  const order = await getOrderByNumber(orderNumber);
  if (!client || !order) return NextResponse.json({ ok: false, message: 'That order could not be found.' }, { status: 404 });
  if (!holdIsLive(order)) {
    return NextResponse.json({ ok: false, code: 'HOLD_EXPIRED', message: 'Your hold expired. Nothing was charged.' }, { status: 409 });
  }

  const { name, email, phone, consentText } = parsed.data;
  const { error } = await client
    .from('orders')
    .update({
      customer_name: name,
      customer_email: email.toLowerCase(),
      customer_phone: phone || null,
      consent_text: consentText,
      consent_at: new Date().toISOString(),
    })
    .eq('id', order.id);
  if (error) return NextResponse.json({ ok: false, message: 'Could not save that. Try again.' }, { status: 500 });

  // Stripe's receipt should match ours. Best effort: a failure here must not
  // stop the payment.
  const stripe = getStripe();
  if (stripe && order.stripePaymentIntentId) {
    try {
      await stripe.paymentIntents.update(order.stripePaymentIntentId, {
        receipt_email: email.toLowerCase(),
        metadata: { customer_name: name },
      });
    } catch (updateError) {
      console.warn('[customer] payment intent update failed:', updateError instanceof Error ? updateError.message : updateError);
    }
  }

  return NextResponse.json({ ok: true });
}
