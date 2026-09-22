import type Stripe from 'stripe';

/**
 * What a Stripe event does to an order.
 *
 * Pure: every database effect goes through `WebhookStore`, so the branches
 * can be tested against an in-memory double with no Stripe and no Postgres.
 * The route handler verifies the signature, records the event id (that insert
 * is the idempotency guard) and then calls `handleStripeEvent`.
 *
 * This is the ONLY place an order becomes paid. The success redirect never
 * fulfils. Email goes out after the store has committed and may never make
 * the webhook fail.
 */

export interface StoredOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  refundedCents: number;
  stripePaymentIntentId: string | null;
  /** When the seats stopped being held. Null for an order that never held any. */
  expiresAt: string | null;
}

export interface WebhookStore {
  findOrderByPaymentIntent(paymentIntentId: string): Promise<StoredOrder | null>;
  /** `fulfill_order`: mark paid, mint tickets exactly once. */
  fulfill(orderId: string, chargeId: string | null, paidAt: Date): Promise<{ minted: number }>;
  setStatus(orderId: string, status: string, patch?: Record<string, unknown>): Promise<void>;
  releaseHolds(orderId: string): Promise<void>;
  voidTickets(orderId: string, status: 'void' | 'refunded'): Promise<void>;
  /**
   * Can this order's seats still be honoured? Asked only when a payment lands
   * after the hold lapsed, which is the one way a paid order can find its room
   * already sold.
   */
  seatsStillAvailable(orderId: string): Promise<boolean>;
  log(message: string): void;
}

export interface WebhookEffects {
  sendConfirmation(orderId: string): Promise<void>;
  /** Tell the guest their money is on its way back. `full` when every ticket is now void. */
  sendRefundConfirmation(orderId: string, refundCents: number, full: boolean): Promise<void>;
  alertOwner(subject: string, body: string): Promise<void>;
  /** Give the whole payment back. Throws if Stripe refuses, so the event retries. */
  refundInFull(paymentIntentId: string, reason: string): Promise<void>;
}

export type WebhookOutcome =
  | { handled: true; action: string; orderId?: string }
  | { handled: false; reason: string };

function paymentIntentId(value: string | Stripe.PaymentIntent | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function chargeId(pi: Stripe.PaymentIntent): string | null {
  const latest = pi.latest_charge;
  if (!latest) return null;
  return typeof latest === 'string' ? latest : latest.id;
}

export async function handleStripeEvent(
  event: Stripe.Event,
  store: WebhookStore,
  effects: WebhookEffects,
): Promise<WebhookOutcome> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      const order = await store.findOrderByPaymentIntent(pi.id);
      if (!order) return { handled: false, reason: `no order for ${pi.id}` };

      // The one way a paid order can find its room already gone: the hold
      // lapsed while the card was being typed and somebody else took the
      // seats. Money is never quietly kept for a ticket that cannot exist —
      // it goes straight back and the owner hears about it.
      const lapsed = order.status === 'pending' && order.expiresAt !== null && Date.parse(order.expiresAt) <= Date.now();
      if (lapsed && !(await store.seatsStillAvailable(order.id))) {
        try {
          await effects.refundInFull(pi.id, `Oversold: ${order.orderNumber}`);
        } catch (error) {
          // Leave the order pending and let Stripe retry the event: an
          // un-refunded oversell is the one state nobody may sleep through.
          await effects.alertOwner(
            `URGENT: could not refund oversold ${order.orderNumber}`,
            `The seats for ${order.orderNumber} were gone when the payment landed and the refund failed: ${String(error)}. Refund it by hand in Stripe.`,
          );
          throw error;
        }
        await store.setStatus(order.id, 'canceled', {
          refunded_cents: order.totalCents,
          notes: 'Sold out while the payment was being taken. Refunded in full automatically.',
        });
        await store.releaseHolds(order.id);
        store.log(`OVERSOLD ${order.orderNumber}: refunded ${order.totalCents} cents, no tickets issued`);
        await effects.alertOwner(
          `Refunded an oversold order: ${order.orderNumber}`,
          `The last seats went while ${order.orderNumber} was paying. The full amount has been refunded automatically and no tickets were issued. They deserve an apology and probably a comp.`,
        );
        return { handled: true, action: 'oversold-refunded', orderId: order.id };
      }

      const { minted } = await store.fulfill(order.id, chargeId(pi), new Date(event.created * 1000));
      store.log(`paid ${order.orderNumber}, minted ${minted}`);
      // After the commit, and never allowed to fail the webhook.
      if (minted > 0) {
        try {
          await effects.sendConfirmation(order.id);
        } catch (error) {
          store.log(`confirmation email failed for ${order.orderNumber}: ${String(error)}`);
        }
      }
      return { handled: true, action: 'paid', orderId: order.id };
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const order = await store.findOrderByPaymentIntent(pi.id);
      if (!order) return { handled: false, reason: `no order for ${pi.id}` };
      if (order.status === 'paid') return { handled: true, action: 'ignored-already-paid', orderId: order.id };
      const reason = pi.last_payment_error?.message ?? pi.last_payment_error?.code ?? 'unknown';
      await store.setStatus(order.id, 'failed', { notes: `Payment failed: ${reason}` });
      await store.releaseHolds(order.id);
      store.log(`failed ${order.orderNumber}: ${reason}`);
      return { handled: true, action: 'failed', orderId: order.id };
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object;
      const order = await store.findOrderByPaymentIntent(pi.id);
      if (!order) return { handled: false, reason: `no order for ${pi.id}` };
      if (order.status === 'paid') return { handled: true, action: 'ignored-already-paid', orderId: order.id };
      await store.setStatus(order.id, 'canceled');
      await store.releaseHolds(order.id);
      return { handled: true, action: 'canceled', orderId: order.id };
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      const piId = paymentIntentId(charge.payment_intent);
      if (!piId) return { handled: false, reason: 'refund without a payment intent' };
      const order = await store.findOrderByPaymentIntent(piId);
      if (!order) return { handled: false, reason: `no order for ${piId}` };
      const refunded = charge.amount_refunded;
      const full = refunded >= order.totalCents;
      // Read before the update: what had already been given back decides
      // how much THIS event is announcing.
      const previouslyRefunded = order.refundedCents;
      await store.setStatus(order.id, full ? 'refunded' : 'partially_refunded', {
        refunded_cents: refunded,
        ...(full ? {} : { notes: 'Partial refund from Stripe. Tickets left valid; decide which to void.' }),
      });
      // A full refund voids every ticket. A partial one voids none on its own —
      // the admin decides which — and is flagged.
      if (full) await store.voidTickets(order.id, 'refunded');
      else await effects.alertOwner(`Partial refund on ${order.orderNumber}`, `Stripe refunded ${refunded} cents of ${order.totalCents}. Decide which tickets to void in the admin.`);
      // After the commit, and never allowed to fail the webhook. Only the
      // money that moved in THIS event is announced; a replay is a no-op
      // because the refunded total has not changed.
      const thisRefund = refunded - previouslyRefunded;
      if (thisRefund > 0) {
        try {
          await effects.sendRefundConfirmation(order.id, thisRefund, full);
        } catch (error) {
          store.log(`refund email failed for ${order.orderNumber}: ${String(error)}`);
        }
      }
      return { handled: true, action: full ? 'refunded' : 'partially_refunded', orderId: order.id };
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object;
      const piId = paymentIntentId(dispute.payment_intent);
      if (!piId) return { handled: false, reason: 'dispute without a payment intent' };
      const order = await store.findOrderByPaymentIntent(piId);
      if (!order) return { handled: false, reason: `no order for ${piId}` };
      await store.setStatus(order.id, 'disputed', { notes: `Disputed: ${dispute.reason ?? 'no reason given'}` });
      await store.voidTickets(order.id, 'void');
      await effects.alertOwner(
        `Chargeback on ${order.orderNumber}`,
        `A guest disputed ${order.totalCents} cents. Their tickets are void and will scan red. Respond in the Stripe Dashboard.`,
      );
      return { handled: true, action: 'disputed', orderId: order.id };
    }

    default:
      store.log(`ignored ${event.type}`);
      return { handled: false, reason: `unhandled ${event.type}` };
  }
}
