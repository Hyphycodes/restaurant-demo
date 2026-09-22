import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { handleStripeEvent, type StoredOrder, type WebhookStore } from './webhook';

function memoryStore(order: StoredOrder, seatsLeft = true) {
  const state = {
    order: { ...order },
    tickets: 0,
    holdsReleased: 0,
    ticketStatus: 'valid' as string,
    logs: [] as string[],
  };
  const store: WebhookStore = {
    async findOrderByPaymentIntent(id) {
      return state.order.stripePaymentIntentId === id ? state.order : null;
    },
    async fulfill(_id, _charge, _paidAt) {
      // Mirrors fulfill_order: a second call mints nothing.
      if (state.order.status === 'paid') return { minted: 0 };
      state.order.status = 'paid';
      state.tickets = 2;
      return { minted: 2 };
    },
    async setStatus(_id, status, patch) {
      state.order.status = status;
      if (patch && typeof patch.refunded_cents === 'number') state.order.refundedCents = patch.refunded_cents;
    },
    async releaseHolds() {
      state.holdsReleased += 1;
    },
    async voidTickets(_id, status) {
      state.ticketStatus = status;
    },
    async seatsStillAvailable() {
      return seatsLeft;
    },
    log(message) {
      state.logs.push(message);
    },
  };
  return { store, state };
}

const baseOrder: StoredOrder = {
  id: 'order-1',
  orderNumber: 'CNS-TEST1',
  status: 'pending',
  totalCents: 2000,
  refundedCents: 0,
  stripePaymentIntentId: 'pi_1',
  // A live hold: the seats are still this order's.
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
};

/** The same order, but the hold lapsed while the card was being typed. */
const lapsedOrder: StoredOrder = { ...baseOrder, expiresAt: new Date(Date.now() - 60_000).toISOString() };

function event(type: string, object: Record<string, unknown>): Stripe.Event {
  return { id: `evt_${type}`, type, created: 1_700_000_000, data: { object } } as unknown as Stripe.Event;
}

function effects(refund?: () => Promise<void>) {
  const calls = { confirmations: 0, alerts: [] as string[], refunds: [] as string[], refundEmails: [] as { orderId: string; cents: number; full: boolean }[] };
  return {
    calls,
    effects: {
      async sendConfirmation() {
        calls.confirmations += 1;
      },
      async sendRefundConfirmation(orderId: string, cents: number, full: boolean) {
        calls.refundEmails.push({ orderId, cents, full });
      },
      async alertOwner(subject: string) {
        calls.alerts.push(subject);
      },
      async refundInFull(paymentIntentId: string) {
        calls.refunds.push(paymentIntentId);
        if (refund) await refund();
      },
    },
  };
}

describe('handleStripeEvent', () => {
  it('payment_intent.succeeded pays the order, mints once, emails once', async () => {
    const { store, state } = memoryStore(baseOrder);
    const fx = effects();
    const pi = { id: 'pi_1', latest_charge: 'ch_1' };
    const first = await handleStripeEvent(event('payment_intent.succeeded', pi), store, fx.effects);
    const replay = await handleStripeEvent(event('payment_intent.succeeded', pi), store, fx.effects);
    expect(first).toMatchObject({ handled: true, action: 'paid' });
    expect(replay).toMatchObject({ handled: true, action: 'paid' });
    expect(state.order.status).toBe('paid');
    expect(state.tickets).toBe(2);
    expect(fx.calls.confirmations).toBe(1);
  });

  it('survives five deliveries of the same event with one order and one email', async () => {
    // Stripe retries. Five times is not paranoia: a webhook that times out
    // once is redelivered, and the guard is what stops five tickets.
    const { store, state } = memoryStore(baseOrder);
    const fx = effects();
    const pi = { id: 'pi_1', latest_charge: 'ch_1' };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const outcome = await handleStripeEvent(event('payment_intent.succeeded', pi), store, fx.effects);
      expect(outcome).toMatchObject({ handled: true, action: 'paid' });
    }
    expect(state.tickets).toBe(2);
    expect(fx.calls.confirmations).toBe(1);
    expect(fx.calls.refunds).toEqual([]);
  });

  it('refunds in full when the seats went while the card was being taken', async () => {
    const { store, state } = memoryStore(lapsedOrder, false);
    const fx = effects();
    const outcome = await handleStripeEvent(
      event('payment_intent.succeeded', { id: 'pi_1', latest_charge: 'ch_1' }),
      store,
      fx.effects,
    );
    expect(outcome).toMatchObject({ handled: true, action: 'oversold-refunded' });
    expect(fx.calls.refunds).toEqual(['pi_1']);
    // No tickets, money back, holds released, and the owner told.
    expect(state.tickets).toBe(0);
    expect(state.order.status).toBe('canceled');
    expect(state.order.refundedCents).toBe(2000);
    expect(state.holdsReleased).toBe(1);
    expect(fx.calls.alerts.some((line) => line.includes('oversold'))).toBe(true);
    expect(fx.calls.confirmations).toBe(0);
  });

  it('keeps an order whose hold lapsed but whose seats are still free', async () => {
    const { store, state } = memoryStore(lapsedOrder, true);
    const fx = effects();
    const outcome = await handleStripeEvent(
      event('payment_intent.succeeded', { id: 'pi_1', latest_charge: 'ch_1' }),
      store,
      fx.effects,
    );
    expect(outcome).toMatchObject({ handled: true, action: 'paid' });
    expect(fx.calls.refunds).toEqual([]);
    expect(state.tickets).toBe(2);
  });

  it('never silently keeps the money when the refund itself fails', async () => {
    const { store, state } = memoryStore(lapsedOrder, false);
    const fx = effects(async () => { throw new Error('stripe down'); });
    await expect(
      handleStripeEvent(event('payment_intent.succeeded', { id: 'pi_1', latest_charge: 'ch_1' }), store, fx.effects),
    ).rejects.toThrow('stripe down');
    // Still pending, so the retried event tries the refund again, and the
    // owner has already been told to do it by hand.
    expect(state.order.status).toBe('pending');
    expect(state.tickets).toBe(0);
    expect(fx.calls.alerts.some((line) => line.includes('URGENT'))).toBe(true);
  });

  it('a failing email never fails the webhook', async () => {
    const { store, state } = memoryStore(baseOrder);
    const outcome = await handleStripeEvent(
      event('payment_intent.succeeded', { id: 'pi_1', latest_charge: 'ch_1' }),
      store,
      { sendConfirmation: async () => { throw new Error('smtp down'); }, sendRefundConfirmation: async () => {}, alertOwner: async () => {}, refundInFull: async () => {} },
    );
    expect(outcome.handled).toBe(true);
    expect(state.order.status).toBe('paid');
    expect(state.logs.some((line) => line.includes('confirmation email failed'))).toBe(true);
  });

  it('payment_intent.payment_failed fails the order and releases holds', async () => {
    const { store, state } = memoryStore(baseOrder);
    const fx = effects();
    await handleStripeEvent(
      event('payment_intent.payment_failed', { id: 'pi_1', last_payment_error: { message: 'Card declined' } }),
      store,
      fx.effects,
    );
    expect(state.order.status).toBe('failed');
    expect(state.holdsReleased).toBe(1);
  });

  it('payment_intent.canceled cancels and releases, but never un-pays', async () => {
    const { store, state } = memoryStore({ ...baseOrder, status: 'paid' });
    const fx = effects();
    const outcome = await handleStripeEvent(event('payment_intent.canceled', { id: 'pi_1' }), store, fx.effects);
    expect(outcome).toMatchObject({ action: 'ignored-already-paid' });
    expect(state.order.status).toBe('paid');

    const pending = memoryStore(baseOrder);
    await handleStripeEvent(event('payment_intent.canceled', { id: 'pi_1' }), pending.store, fx.effects);
    expect(pending.state.order.status).toBe('canceled');
    expect(pending.state.holdsReleased).toBe(1);
  });

  it('charge.refunded in full voids every ticket; partial flags the owner', async () => {
    const full = memoryStore({ ...baseOrder, status: 'paid' });
    const fx = effects();
    await handleStripeEvent(event('charge.refunded', { payment_intent: 'pi_1', amount_refunded: 2000 }), full.store, fx.effects);
    expect(full.state.order.status).toBe('refunded');
    expect(full.state.ticketStatus).toBe('refunded');

    const partial = memoryStore({ ...baseOrder, status: 'paid' });
    await handleStripeEvent(event('charge.refunded', { payment_intent: 'pi_1', amount_refunded: 500 }), partial.store, fx.effects);
    expect(partial.state.order.status).toBe('partially_refunded');
    expect(partial.state.order.refundedCents).toBe(500);
    expect(partial.state.ticketStatus).toBe('valid');
    expect(fx.calls.alerts[0]).toMatch(/Partial refund/);
  });

  it('charge.dispute.created voids tickets and alerts the owner', async () => {
    const { store, state } = memoryStore({ ...baseOrder, status: 'paid' });
    const fx = effects();
    await handleStripeEvent(event('charge.dispute.created', { payment_intent: 'pi_1', reason: 'fraudulent' }), store, fx.effects);
    expect(state.order.status).toBe('disputed');
    expect(state.ticketStatus).toBe('void');
    expect(fx.calls.alerts[0]).toMatch(/Chargeback/);
  });

  it('unknown events are logged and ignored', async () => {
    const { store, state } = memoryStore(baseOrder);
    const outcome = await handleStripeEvent(event('customer.created', {}), store, effects().effects);
    expect(outcome.handled).toBe(false);
    expect(state.logs[0]).toContain('ignored customer.created');
  });
});

describe('refund emails', () => {
  it('a full refund tells the guest once, for the money that moved in this event', async () => {
    const { store, state } = memoryStore({ ...baseOrder, status: 'paid' });
    const fx = effects();
    await handleStripeEvent(event('charge.refunded', { payment_intent: 'pi_1', amount_refunded: 2000 }), store, fx.effects);
    expect(state.order.status).toBe('refunded');
    expect(state.ticketStatus).toBe('refunded');
    expect(fx.calls.refundEmails).toEqual([{ orderId: 'order-1', cents: 2000, full: true }]);
    // The same event again: the refunded total has not changed, so no second email.
    await handleStripeEvent(event('charge.refunded', { payment_intent: 'pi_1', amount_refunded: 2000 }), store, fx.effects);
    expect(fx.calls.refundEmails).toHaveLength(1);
  });

  it('a partial refund announces only the partial amount and leaves tickets valid', async () => {
    const { store, state } = memoryStore({ ...baseOrder, status: 'paid' });
    const fx = effects();
    await handleStripeEvent(event('charge.refunded', { payment_intent: 'pi_1', amount_refunded: 500 }), store, fx.effects);
    expect(state.order.status).toBe('partially_refunded');
    expect(state.ticketStatus).toBe('valid');
    expect(fx.calls.refundEmails).toEqual([{ orderId: 'order-1', cents: 500, full: false }]);
    expect(fx.calls.alerts.some((line) => line.includes('Partial refund'))).toBe(true);
  });

  it('a failing refund email never fails the webhook', async () => {
    const { store, state } = memoryStore({ ...baseOrder, status: 'paid' });
    const fx = effects();
    fx.effects.sendRefundConfirmation = async () => {
      throw new Error('smtp down');
    };
    const outcome = await handleStripeEvent(event('charge.refunded', { payment_intent: 'pi_1', amount_refunded: 2000 }), store, fx.effects);
    expect(outcome.handled).toBe(true);
    expect(state.logs.some((line) => line.includes('refund email failed'))).toBe(true);
  });
});
