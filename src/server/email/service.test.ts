import { describe, expect, it } from 'vitest';

// The order mapper signs the 30-day tickets link, which needs the secret.
process.env.TICKET_SIGNING_SECRET = 'test-signing-secret-that-is-long-enough-32';

import * as f from '@/emails/fixtures';
import type { EmailLogType, EmailSwitchId } from '@/emails/registry';
import type { OrderRecord } from '@/server/ticketing/orders';
import type { EmailConfig } from './config';
import type { EmailLogEntry, EmailStore } from './log';
import { createEmailService, type EmailServiceDeps } from './service';
import type { EmailMessage } from './transport';

/**
 * The service's rules, against memory doubles. No Resend, no Supabase.
 *
 *   - guests are never emailed while EMAIL_DELIVERY_ENABLED is off, and the
 *     attempt is logged as skipped with the reason;
 *   - a confirmation goes once per order, however many times it is asked for;
 *   - a redirect address swallows every guest email in staging;
 *   - a test send ignores the guest switch and is marked as a test;
 *   - a mailer failure is a logged `failed`, never a throw;
 *   - a missing address is a skip, not a crash.
 */

const order: OrderRecord = {
  id: 'order-1',
  orderNumber: 'CNS-TEST1',
  eventId: 'evt_vinyl',
  status: 'paid',
  customerName: 'Jamie Morgan',
  customerEmail: 'maria@example.com',
  customerPhone: null,
  subtotalCents: 9000,
  serviceFeeCents: 0,
  taxCents: 0,
  discountCents: 0,
  totalCents: 9000,
  refundedCents: 0,
  source: 'web',
  stripePaymentIntentId: 'pi_1',
  consentText: null,
  expiresAt: null,
  paidAt: '2026-10-02T19:14:00.000Z',
  createdAt: '2026-10-02T19:00:00.000Z',
  items: [{ id: 'item-1', tierId: 'tier-1', tierName: 'Supper Club Admission', unitPriceCents: 4500, quantity: 2, seats: 1, subtotalCents: 9000 }],
  tickets: [
    { id: 't-1', orderItemId: 'item-1', tierId: 'tier-1', code: 'AAAA-1111', status: 'valid', seats: 1, attendeeName: null, checkedInAt: null },
    { id: 't-2', orderItemId: 'item-1', tierId: 'tier-1', code: 'BBBB-2222', status: 'valid', seats: 1, attendeeName: null, checkedInAt: null },
  ],
};

function harness(
  overrides: Partial<EmailConfig> = {},
  options: { transport?: boolean; orders?: OrderRecord[]; switches?: Partial<Record<EmailSwitchId, boolean>> } = {},
) {
  const sent: EmailMessage[] = [];
  const logged: EmailLogEntry[] = [];
  const config: EmailConfig = {
    transportConfigured: options.transport ?? true,
    from: 'Cosa Nostra <tickets@tickets.example.com>',
    fromAddress: 'tickets@tickets.example.com',
    fromProblem: null,
    replyTo: null,
    deliveryEnabled: true,
    redirectTo: null,
    ownerAlertEmail: 'owner@example.com',
    webhookSecretSet: false,
    authHookSecretSet: false,
    ticketDirection: 'pass',
    ...overrides,
  };
  const store: EmailStore = {
    async log(entry) {
      logged.push(entry);
    },
    async hasSent(orderId: string, type: EmailLogType) {
      return logged.some((entry) => entry.orderId === orderId && entry.type === type && entry.status === 'sent');
    },
  };
  const orders = options.orders ?? [order];
  const deps: EmailServiceDeps = {
    config: () => config,
    transport:
      (options.transport ?? true)
        ? () => ({
            async send(message) {
              if (message.subject.includes('BOOM')) throw new Error('provider down');
              sent.push(message);
              return { id: `msg_${sent.length}` };
            },
          })
        : () => null,
    store: () => store,
    loadOrder: async (id) => orders.find((entry) => entry.id === id) ?? null,
    loadEvent: async (id) => (id === 'evt_vinyl' ? f.vinylSession : null),
    loadBrand: async () => f.brand,
    listPaidOrders: async (eventId, statuses) => orders.filter((entry) => entry.eventId === eventId && statuses.includes(entry.status)),
    buildTickets: async (record, tickets) => ({
      tickets: tickets.map((ticket, index) => ({
        id: ticket.id,
        code: ticket.code,
        tierName: 'Supper Club Admission',
        seats: ticket.seats,
        status: ticket.status,
        attendeeName: null,
        qrSrc: `cid:qr${index + 1}`,
        ticketUrl: `https://example.com/t/${ticket.id}`,
      })),
      attachments: tickets.map((ticket, index) => ({ filename: `${ticket.code}.png`, content: Buffer.from('png'), contentType: 'image/png', contentId: `qr${index + 1}` })),
    }),
    signingConfigured: () => true,
    ...(options.switches ? { switches: async () => options.switches! } : {}),
    log: () => {},
  };
  return { service: createEmailService(deps), sent, logged, config };
}

describe('the delivery guard', () => {
  it('never emails a guest while EMAIL_DELIVERY_ENABLED is off, and says why', async () => {
    const { service, sent, logged } = harness({ deliveryEnabled: false });
    const result = await service.sendTicketConfirmation('order-1');
    expect(result.status).toBe('skipped');
    expect(result.reason).toContain('EMAIL_DELIVERY_ENABLED');
    expect(sent).toHaveLength(0);
    expect(logged.at(-1)).toMatchObject({ type: 'confirmation', status: 'skipped', to: 'maria@example.com', orderId: 'order-1' });
  });

  it('still sends a test and a staff invitation with the guest switch off', async () => {
    const { service, sent } = harness({ deliveryEnabled: false });
    const test = await service.sendTest({ templateId: 'ticket_confirmation', eventId: 'evt_vinyl', to: 'enzo@example.com' });
    expect(test.status).toBe('sent');
    expect(sent[0]!.subject.startsWith('[TEST] ')).toBe(true);
    expect(sent[0]!.html).toContain('Test email');
    const invite = await service.sendStaffInvitation({ name: 'Alex', email: 'alex@example.com', role: 'Manager', invitedBy: 'Alessandro', acceptUrl: 'https://example.com/a', expiresInHours: 24 });
    expect(invite.status).toBe('sent');
  });

  it('a redirect address swallows every guest email and says who it was for', async () => {
    const { service, sent } = harness({ redirectTo: 'staging@example.com' });
    const result = await service.sendTicketConfirmation('order-1');
    expect(result.to).toBe('staging@example.com');
    expect(sent[0]!.to).toBe('staging@example.com');
    expect(sent[0]!.subject).toContain('[for maria@example.com]');
  });

  it('skips cleanly when the mailer or the sender is missing', async () => {
    const noKey = harness({ transportConfigured: false }, { transport: false });
    expect((await noKey.service.sendTicketConfirmation('order-1')).reason).toContain('RESEND_API_KEY');
    const noFrom = harness({ from: null, fromAddress: null, fromProblem: 'ORDERS_FROM_EMAIL is not set.' });
    expect((await noFrom.service.sendTicketConfirmation('order-1')).reason).toContain('ORDERS_FROM_EMAIL');
  });
});

describe('the ticket confirmation', () => {
  it('goes once per order, however many times it is asked for', async () => {
    const { service, sent } = harness();
    const first = await service.sendTicketConfirmation('order-1');
    const second = await service.sendTicketConfirmation('order-1');
    const third = await service.sendTicketConfirmation('order-1');
    expect(first.status).toBe('sent');
    expect(second.status).toBe('skipped');
    expect(third.reason).toContain('already sent');
    expect(sent).toHaveLength(1);
    // A deliberate resend is a different email type and always goes.
    expect((await service.sendTicketResend('order-1')).status).toBe('sent');
    expect(sent).toHaveLength(2);
  });

  it('carries every ticket as a QR attachment referenced by cid, with a stable reference id', async () => {
    const { service, sent } = harness();
    await service.sendTicketConfirmation('order-1');
    const message = sent[0]!;
    expect(message.attachments?.map((attachment) => attachment.contentId)).toEqual(['qr1', 'qr2']);
    expect(message.html).toContain('cid:qr1');
    expect(message.html).toContain('AAAA-1111');
    expect(message.text).toContain('BBBB-2222');
    expect(message.headers?.['X-Entity-Ref-ID']).toBe('CNS-TEST1-confirmation');
  });

  it('is skipped for an unpaid order, a missing address or a missing event', async () => {
    const pending = harness({}, { orders: [{ ...order, status: 'pending' }] });
    expect((await pending.service.sendTicketConfirmation('order-1')).reason).toContain('not paid');
    const noEmail = harness({}, { orders: [{ ...order, customerEmail: null }] });
    const result = await noEmail.service.sendTicketConfirmation('order-1');
    expect(result.status).toBe('skipped');
    expect(noEmail.logged.at(-1)?.error).toBe('no email address');
    const badEmail = harness({}, { orders: [{ ...order, customerEmail: 'not-an-address' }] });
    expect((await badEmail.service.sendTicketConfirmation('order-1')).reason).toContain('not valid');
    const noEvent = harness({}, { orders: [{ ...order, eventId: 'evt_missing' }] });
    expect((await noEvent.service.sendTicketConfirmation('order-1')).reason).toContain('Event not found');
  });

  it('a provider failure is logged as failed and never thrown', async () => {
    // The transport throws on a subject containing BOOM; an event title carries it into every subject.
    const { service, logged } = harness({}, { orders: [order] });
    const boom = createEmailService({
      config: () => ({ transportConfigured: true, from: 'Cosa Nostra <t@t.example.com>', fromAddress: 't@t.example.com', fromProblem: null, replyTo: null, deliveryEnabled: true, redirectTo: null, ownerAlertEmail: null, webhookSecretSet: false, authHookSecretSet: false, ticketDirection: 'pass' }),
      transport: () => ({ async send() { throw new Error('provider down'); } }),
      store: () => ({ async log(entry) { logged.push(entry); }, async hasSent() { return false; } }),
      loadOrder: async () => order,
      loadEvent: async () => f.vinylSession,
      loadBrand: async () => f.brand,
      listPaidOrders: async () => [order],
      buildTickets: async () => ({ tickets: f.threeTickets, attachments: [] }),
      signingConfigured: () => true,
      log: () => {},
    });
    void service;
    const result = await boom.sendTicketConfirmation('order-1');
    expect(result.status).toBe('failed');
    expect(result.reason).toBe('provider down');
    expect(logged.at(-1)).toMatchObject({ type: 'confirmation', status: 'failed', error: 'provider down' });
  });
});

describe('refunds and event updates', () => {
  it('a refund names the amount and which tickets, and stands down after a cancellation email', async () => {
    const { service, sent } = harness({}, { orders: [{ ...order, status: 'refunded', refundedCents: 9000, tickets: order.tickets.map((ticket) => ({ ...ticket, status: 'refunded' as const })) }] });
    const result = await service.sendRefundConfirmation('order-1', { refundCents: 9000, status: 'processing' });
    expect(result.status).toBe('sent');
    expect(sent[0]!.subject).toBe('Refund of $90 — Vinyl & Vermouth, Thu Oct 15');
    expect(sent[0]!.html).toContain('Every ticket on this order is now cancelled');
    expect(sent[0]!.attachments ?? []).toHaveLength(0);
  });

  it('a cancellation reaches every paid order once and the refund email then stays quiet', async () => {
    const second: OrderRecord = { ...order, id: 'order-2', orderNumber: 'CNS-TEST2', customerEmail: 'sam@example.com', source: 'door', totalCents: 4500 };
    const { service, sent } = harness({}, { orders: [order, second] });
    const outcome = await service.sendEventUpdate('evt_vinyl', { kind: 'cancelled', message: 'Sorry.' });
    expect(outcome.sent).toBe(2);
    expect(sent.map((message) => message.to).sort()).toEqual(['maria@example.com', 'sam@example.com']);
    // The card order is told its refund is automatic; the door order is not.
    expect(sent.find((message) => message.to === 'maria@example.com')!.html).toContain('refunded automatically');
    expect(sent.find((message) => message.to === 'sam@example.com')!.html).toContain('being arranged');
    // Again: nobody is told twice.
    const again = await service.sendEventUpdate('evt_vinyl', { kind: 'cancelled' });
    expect(again.sent).toBe(0);
    expect(again.skipped).toBe(2);
    // And the refund that follows from Stripe does not add a third email.
    const refund = await service.sendRefundConfirmation('order-1', { refundCents: 9000, status: 'processing' });
    expect(refund.status).toBe('skipped');
    expect(refund.reason).toContain('cancellation');
  });

  it('a time change goes to live orders with their tickets attached', async () => {
    const { service, sent } = harness();
    const outcome = await service.sendEventUpdate('evt_vinyl', { kind: 'time_change', previous: { startsAt: f.vinylSession.startsAt, endsAt: f.vinylSession.endsAt } });
    expect(outcome.sent).toBe(1);
    expect(sent[0]!.subject).toMatch(/^Time change: /);
    expect(sent[0]!.attachments).toHaveLength(2);
  });
});

describe('reminders and previews', () => {
  it('a reminder is skipped once every ticket is used or the event is cancelled', async () => {
    const used = harness({}, { orders: [{ ...order, tickets: order.tickets.map((ticket) => ({ ...ticket, status: 'checked_in' as const })) }] });
    expect((await used.service.sendEventReminder('order-1')).reason).toContain('No unused tickets');
    const { service, sent } = harness();
    expect((await service.sendEventReminder('order-1', 'tomorrow')).status).toBe('sent');
    expect(sent[0]!.subject).toMatch(/^Tomorrow — /);
  });

  it('a preview renders any template against the real event without sending', async () => {
    const { service, sent } = harness();
    const preview = await service.renderPreview({ templateId: 'event_update', variant: 'date_change', eventId: 'evt_vinyl' });
    expect('error' in preview).toBe(false);
    if ('error' in preview) return;
    expect(preview.rendered.html).toContain('Vinyl &amp; Vermouth');
    expect(preview.attachments.length).toBeGreaterThan(0);
    expect(sent).toHaveLength(0);
    const missing = await service.renderPreview({ templateId: 'ticket_confirmation', eventId: 'evt_nope' });
    expect(missing).toEqual({ error: 'That event could not be found.' });
  });

  it('an owner alert goes to OWNER_ALERT_EMAIL regardless of the guest switch', async () => {
    const { service, sent } = harness({ deliveryEnabled: false });
    expect((await service.sendOwnerAlert('Chargeback', 'Details')).status).toBe('sent');
    expect(sent[0]!.to).toBe('owner@example.com');
    expect(sent[0]!.subject).toBe('[Cosa Nostra tickets] Chargeback');
  });
});

describe('the switches', () => {
  it('sends the optional emails when nothing has been switched', async () => {
    const { service } = harness();
    const result = await service.sendStaffNotice('shift_changed', f.shiftChanged);
    expect(result.status).toBe('sent');
  });

  it('withholds a staff notice the owner has switched off, and says so', async () => {
    const { service, sent, logged } = harness({}, { switches: { shift_changed: false } });
    const result = await service.sendStaffNotice('shift_changed', f.shiftChanged);
    expect(result.status).toBe('skipped');
    expect(result.reason).toContain('switched off');
    expect(sent).toHaveLength(0);
    // Nothing was attempted, so nothing pretends to be an attempt in the log.
    expect(logged).toHaveLength(0);
  });

  it('switches the two reminder passes independently', async () => {
    const { service } = harness({}, { switches: { event_reminder: true, event_reminder_tonight: false } });
    expect((await service.sendEventReminder('order-1', 'tonight')).status).toBe('skipped');
    expect((await service.sendEventReminder('order-1', 'tomorrow')).status).toBe('sent');
  });

  it('never offers to withhold a ticket: the confirmation has no switch to consult', async () => {
    const { service } = harness({}, { switches: { thanks_for_coming: false, event_reminder: false } });
    expect((await service.sendTicketConfirmation('order-1')).status).toBe('sent');
  });
});
