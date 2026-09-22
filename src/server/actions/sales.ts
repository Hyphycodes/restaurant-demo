'use server';

import { z } from 'zod';
import { getStripe } from '@/lib/stripe';
import { getStaff, staffCan } from '@/server/auth';
import { emailService } from '@/server/email/service';
import { getTicketingClient } from '@/server/ticketing/db';
import { getOrderById } from '@/server/ticketing/orders';

/**
 * Refund an order.
 *
 * A card order is refunded at Stripe and nothing else changes here: the
 * webhook sets the status and voids the tickets, exactly as a refund made in
 * the Dashboard would. A door or comp order has no charge to reverse, so it
 * is marked refunded directly and its tickets voided.
 */
const schema = z.object({ orderId: z.string().uuid() });

export interface RefundState {
  ok: boolean;
  message: string;
}

export async function refundOrder(_prev: RefundState, formData: FormData): Promise<RefundState> {
  const staff = await getStaff();
  if (!staff || !staffCan(staff, 'content.publish')) return { ok: false, message: 'Only a manager or the owner can refund.' };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: 'Could not tell which order to refund.' };

  const order = await getOrderById(parsed.data.orderId);
  const client = getTicketingClient();
  if (!order || !client) return { ok: false, message: 'That order could not be found.' };
  if (order.status === 'refunded') return { ok: false, message: 'Already refunded.' };

  if (order.stripePaymentIntentId) {
    const stripe = getStripe();
    if (!stripe) return { ok: false, message: 'Stripe is not connected on this copy of the site.' };
    try {
      await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId }, { idempotencyKey: `refund-${order.id}` });
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Stripe refused the refund.' };
    }
    return { ok: true, message: `Refund sent to Stripe for ${order.orderNumber}. The tickets will read as refunded in a moment.` };
  }

  const { error } = await client
    .from('orders')
    .update({ status: 'refunded', refunded_cents: order.totalCents, notes: `Refunded at the register by ${staff.name || staff.email}` })
    .eq('id', order.id);
  if (error) return { ok: false, message: 'Could not mark that refunded.' };
  await client.from('tickets').update({ status: 'refunded' }).eq('order_id', order.id);
  // The guest hears about it the same way a card refund is announced by the webhook.
  await emailService.sendRefundConfirmation(order.id, { refundCents: order.totalCents - order.refundedCents, status: 'completed', reason: 'Refunded at the register.' });
  return { ok: true, message: `${order.orderNumber} marked refunded. Give the money back at the register.` };
}
