import 'server-only';

import { INLINE_TICKET_LIMIT } from '@/emails/components/TicketCard';
import * as fixtures from '@/emails/fixtures';
import { EMAIL_SWITCH_DEFAULTS, EMAIL_TEMPLATES, type EmailLogType, type EmailSwitchId, type TemplateId, templateInfo } from '@/emails/registry';
import { renderEmail, type TemplateProps } from '@/emails/render';
import type { EmailBrand, EmailEvent, EmailTicket, EventUpdateKind, RenderedEmail, StaffEmailProps, StaffInvitationProps, TicketDirection } from '@/emails/types';
import { isSigningConfigured } from '@/lib/ticketing/tokens';
import { getTicketingClient } from '@/server/ticketing/db';
import { getOrderById, isPaidStatus, type OrderRecord } from '@/server/ticketing/orders';
import { planAuthEmail, type AuthHookPayload } from './auth-hook';
import { emailConfig, isEmailAddress, type EmailConfig } from './config';
import { attachFixtureQrs, customerFromOrder, liveTickets, loadBrand, loadEmailEvent, orderToEmail, ticketsToEmail } from './data';
import { emailStore, type EmailStore } from './log';
import { emailSwitches } from './settings';
import { resendTransport, type EmailAttachment, type EmailTransport } from './transport';

/**
 * The email service: the one door every send goes through.
 *
 *   emailService.sendTicketConfirmation(orderId)
 *   emailService.sendEventReminder(orderId, 'tomorrow')
 *   emailService.sendTicketResend(orderId)
 *   emailService.sendRefundConfirmation(orderId, {...})
 *   emailService.sendEventUpdate(eventId, {...})
 *   emailService.sendStaffInvitation({...})
 *   emailService.sendStaffNotice('shift_changed', {...})
 *   emailService.sendAuthEmail(payload)
 *   emailService.sendTest({...})
 *   emailService.sendOwnerAlert(subject, body)
 *
 * The backend decides recipient, template, subject, data and timing; React
 * Email renders; Resend delivers; `email_log` remembers. Nothing here
 * throws to a caller: every outcome is a `SendResult`, so a webhook that
 * has just taken money can never be failed by a mailer.
 *
 * Built from injectable dependencies so the rules — the delivery guard,
 * the redirect, the once-only confirmation — are tested against memory
 * doubles with no network.
 */

export interface SendResult {
  ok: boolean;
  status: 'sent' | 'skipped' | 'failed';
  /** Why it was skipped or failed. Safe to show a staff member. */
  reason: string | null;
  providerId: string | null;
  to: string | null;
}

export type Audience = 'guest' | 'staff' | 'internal';

export interface EmailServiceDeps {
  config: () => EmailConfig;
  transport: () => EmailTransport | null;
  store: () => EmailStore | null;
  loadOrder: (orderId: string) => Promise<OrderRecord | null>;
  loadEvent: (eventId: string, options?: { includeDrafts?: boolean }) => Promise<EmailEvent | null>;
  loadBrand: () => Promise<EmailBrand>;
  listPaidOrders: (eventId: string, statuses: string[]) => Promise<OrderRecord[]>;
  buildTickets: typeof ticketsToEmail;
  signingConfigured: () => boolean;
  /**
   * Which optional emails the owner has switched on. Optional, and
   * everything is on when it is absent, so a test double stays short and a
   * settings read that fails can never withhold an email.
   */
  switches?: () => Promise<Partial<Record<EmailSwitchId, boolean>>>;
  log: (message: string) => void;
}

interface DeliverInput {
  audience: Audience;
  type: EmailLogType;
  template: TemplateId | null;
  to: string | null;
  rendered: RenderedEmail;
  orderId?: string | null;
  eventId?: string | null;
  attachments?: EmailAttachment[];
  isTest?: boolean;
  /** Stable per logical email, so a retried send is de-duplicated by the provider. */
  refId?: string;
}

function skipped(reason: string, to: string | null = null): SendResult {
  return { ok: false, status: 'skipped', reason, providerId: null, to };
}

const REFUND_STATUS_TITLE = { processing: 'processing', completed: 'completed' } as const;

export function createEmailService(deps: EmailServiceDeps) {
  /**
   * Is this optional email switched on?
   *
   * Only the ids in `EMAIL_SWITCHES` ever reach here — a ticket, a refund,
   * an event change and a sign-in link have no switch to consult. Anything
   * unreadable is treated as on, so the answer to "why did the reminder not
   * arrive" is never a settings table nobody could see.
   */
  async function switchedOn(id: EmailSwitchId): Promise<boolean> {
    if (!deps.switches) return true;
    try {
      const state = await deps.switches();
      return state[id] ?? EMAIL_SWITCH_DEFAULTS[id] ?? true;
    } catch {
      return true;
    }
  }

  async function record(entry: Parameters<EmailStore['log']>[0]): Promise<void> {
    try {
      await deps.store()?.log(entry);
    } catch (error) {
      deps.log(`email_log write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** The guard, the redirect, the send and the log, in that order. */
  async function deliver(input: DeliverInput): Promise<SendResult> {
    const config = deps.config();
    const base = { type: input.type, orderId: input.orderId ?? null, eventId: input.eventId ?? null, template: input.template, subject: input.rendered.subject, isTest: input.isTest ?? false };
    const to = input.to?.trim() ?? null;

    if (!isEmailAddress(to)) {
      await record({ ...base, to, status: 'skipped', error: to ? 'address is not valid' : 'no email address' });
      return skipped(to ? 'That email address is not valid.' : 'No email address.', to);
    }
    if (input.audience === 'guest' && !input.isTest && !config.deliveryEnabled) {
      await record({ ...base, to, status: 'skipped', error: 'EMAIL_DELIVERY_ENABLED is not true' });
      return skipped('Guest email delivery is switched off (EMAIL_DELIVERY_ENABLED is not true).', to);
    }
    const transport = deps.transport();
    if (!transport) {
      await record({ ...base, to, status: 'skipped', error: 'RESEND_API_KEY not set' });
      return skipped('RESEND_API_KEY is not set.', to);
    }
    if (!config.from) {
      await record({ ...base, to, status: 'skipped', error: config.fromProblem ?? 'sender not configured' });
      return skipped(config.fromProblem ?? 'The sender address is not configured.', to);
    }

    let recipient = to;
    let subject = input.rendered.subject;
    if (config.redirectTo && input.audience === 'guest') {
      recipient = config.redirectTo;
      subject = `[for ${to}] ${subject}`;
    }

    try {
      const { id } = await transport.send({
        from: config.from,
        to: recipient,
        replyTo: config.replyTo,
        subject,
        html: input.rendered.html,
        text: input.rendered.text,
        attachments: input.attachments,
        headers: input.refId ? { 'X-Entity-Ref-ID': input.refId } : undefined,
        tags: { type: input.type, test: input.isTest ? 'yes' : 'no' },
      });
      await record({ ...base, to: recipient, status: 'sent', providerId: id });
      return { ok: true, status: 'sent', reason: null, providerId: id, to: recipient };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.log(`send failed (${input.type}${input.orderId ? ` ${input.orderId}` : ''}): ${message}`);
      await record({ ...base, to: recipient, status: 'failed', error: message });
      return { ok: false, status: 'failed', reason: message, providerId: null, to: recipient };
    }
  }

  /** Everything an order email needs, or the reason it cannot be built. */
  async function orderContext(orderId: string, options: { qr?: 'attach' | 'none'; requirePaid?: boolean; tickets?: 'live' | 'all' } = {}) {
    const order = await deps.loadOrder(orderId);
    if (!order) return { error: 'Order not found.', order: null } as const;
    if ((options.requirePaid ?? true) && !isPaidStatus(order.status)) return { error: `Order is ${order.status}, not paid.`, order } as const;
    if (!deps.signingConfigured()) return { error: 'TICKET_SIGNING_SECRET is not set, so no ticket link can be signed.', order } as const;
    const [event, brand] = await Promise.all([deps.loadEvent(order.eventId), deps.loadBrand()]);
    if (!event) return { error: 'Event not found or not published.', order } as const;
    const source = options.tickets === 'all' ? order.tickets : liveTickets(order);
    const { tickets, attachments } = await deps.buildTickets(order, source, { qr: options.qr ?? 'attach' });
    return { error: null, order, event, brand, customer: customerFromOrder(order), emailOrder: orderToEmail(order), tickets, attachments } as const;
  }

  async function sendEventUpdateForOrder(
    orderId: string,
    input: { kind: EventUpdateKind; message?: string | null; previous?: TemplateProps['event_update']['previous']; type?: EmailLogType },
  ): Promise<SendResult> {
    const type: EmailLogType = input.type ?? (input.kind === 'cancelled' ? 'cancellation' : 'event_update');
    const cancelled = input.kind === 'cancelled';
    if (cancelled && (await deps.store()?.hasSent(orderId, 'cancellation'))) return skipped('Cancellation already sent for this order.');
    const context = await orderContext(orderId, { qr: cancelled ? 'none' : 'attach', requirePaid: !cancelled, tickets: cancelled ? 'all' : 'live' });
    if (context.error) {
      await record({ type, orderId, to: context.order?.customerEmail ?? null, status: 'skipped', error: context.error, template: 'event_update' });
      return skipped(context.error, context.order?.customerEmail ?? null);
    }
    if (cancelled && !['paid', 'partially_refunded', 'refunded'].includes(context.order.status)) return skipped(`Order is ${context.order.status}.`, context.order.customerEmail);
    // A card order is refunded automatically; a door order is handled at the
    // register and a comp had nothing to refund, so those say "being arranged".
    const refundCents = cancelled && context.order.source === 'web' && context.order.totalCents > 0 ? context.order.totalCents : null;
    const rendered = await renderEmail('event_update', {
      brand: context.brand,
      customer: context.customer,
      event: cancelled ? { ...context.event, status: 'cancelled' } : context.event,
      order: context.emailOrder,
      tickets: cancelled ? context.tickets.map((ticket) => ({ ...ticket, status: 'void' as const, qrSrc: null })) : context.tickets,
      kind: input.kind,
      previous: input.previous ?? null,
      message: input.message?.trim() || null,
      refundCents,
    });
    return deliver({ audience: 'guest', type, template: 'event_update', to: context.order.customerEmail, rendered, orderId, eventId: context.order.eventId, attachments: cancelled ? [] : context.attachments, refId: `${context.order.orderNumber}-${type}-${input.kind}-${Date.now()}` });
  }

  return {
    /**
     * After payment is confirmed. Sent ONCE per order: a replayed webhook,
     * a retried job or a second call finds the `sent` row and stops. Pass
     * `force` to send it again deliberately (that is what "resend" is for).
     */
    async sendTicketConfirmation(orderId: string, options: { force?: boolean } = {}): Promise<SendResult> {
      if (!options.force && (await deps.store()?.hasSent(orderId, 'confirmation'))) {
        return skipped('Confirmation already sent for this order.');
      }
      const context = await orderContext(orderId);
      if (context.error) {
        await record({ type: 'confirmation', orderId, to: context.order?.customerEmail ?? null, status: 'skipped', error: context.error, template: 'ticket_confirmation' });
        return skipped(context.error, context.order?.customerEmail ?? null);
      }
      if (context.tickets.length === 0) {
        await record({ type: 'confirmation', orderId, to: context.order.customerEmail, status: 'skipped', error: 'no live tickets on the order', template: 'ticket_confirmation' });
        return skipped('This order has no live tickets.', context.order.customerEmail);
      }
      const rendered = await renderEmail('ticket_confirmation', {
        brand: context.brand,
        customer: context.customer,
        event: context.event,
        order: context.emailOrder,
        tickets: context.tickets,
        direction: deps.config().ticketDirection,
      });
      return deliver({ audience: 'guest', type: 'confirmation', template: 'ticket_confirmation', to: context.order.customerEmail, rendered, orderId, eventId: context.order.eventId, attachments: context.attachments, refId: `${context.order.orderNumber}-confirmation` });
    },

    /** The day before ("tomorrow") or hours before ("tonight"). The cron decides which and when. */
    async sendEventReminder(orderId: string, timing: 'tomorrow' | 'tonight' = 'tomorrow'): Promise<SendResult> {
      const type: EmailLogType = timing === 'tonight' ? 'tonight' : 'reminder';
      if (!(await switchedOn(timing === 'tonight' ? 'event_reminder_tonight' : 'event_reminder'))) {
        return skipped(`The ${timing === 'tonight' ? 'day-of' : 'day-before'} reminder is switched off in the admin.`);
      }
      const context = await orderContext(orderId);
      if (context.error) {
        await record({ type, orderId, to: context.order?.customerEmail ?? null, status: 'skipped', error: context.error, template: 'event_reminder' });
        return skipped(context.error, context.order?.customerEmail ?? null);
      }
      if (context.event.status === 'cancelled' || context.tickets.every((ticket) => ticket.status !== 'valid')) {
        return skipped(context.event.status === 'cancelled' ? 'Event is cancelled.' : 'No unused tickets to remind about.', context.order.customerEmail);
      }
      const rendered = await renderEmail('event_reminder', { brand: context.brand, customer: context.customer, event: context.event, order: context.emailOrder, tickets: context.tickets, timing });
      return deliver({ audience: 'guest', type, template: 'event_reminder', to: context.order.customerEmail, rendered, orderId, eventId: context.order.eventId, attachments: context.attachments, refId: `${context.order.orderNumber}-${type}` });
    },

    /** "Email these to me again." Always sends, rate limited by the route that calls it. */
    async sendTicketResend(orderId: string): Promise<SendResult> {
      const context = await orderContext(orderId);
      if (context.error) {
        await record({ type: 'resend', orderId, to: context.order?.customerEmail ?? null, status: 'skipped', error: context.error, template: 'ticket_resend' });
        return skipped(context.error, context.order?.customerEmail ?? null);
      }
      const rendered = await renderEmail('ticket_resend', { brand: context.brand, customer: context.customer, event: context.event, order: context.emailOrder, tickets: context.tickets });
      return deliver({ audience: 'guest', type: 'resend', template: 'ticket_resend', to: context.order.customerEmail, rendered, orderId, eventId: context.order.eventId, attachments: context.attachments, refId: `${context.order.orderNumber}-resend-${Date.now()}` });
    },

    /**
     * Money going back. `refundCents` is this refund; the order's own
     * `refundedCents` carries the running total. Skipped when a cancellation
     * email already told this guest their refund is coming — one email that
     * says "cancelled, refund on its way" beats two that say it separately.
     */
    async sendRefundConfirmation(
      orderId: string,
      input: { refundCents: number; status: 'processing' | 'completed'; reason?: string | null; ticketIds?: string[] | null },
    ): Promise<SendResult> {
      if (await deps.store()?.hasSent(orderId, 'cancellation')) return skipped('Covered by the cancellation email already sent for this order.');
      const context = await orderContext(orderId, { qr: 'none', requirePaid: false, tickets: 'all' });
      if (context.error) {
        await record({ type: 'refund', orderId, to: context.order?.customerEmail ?? null, status: 'skipped', error: context.error, template: 'refund_confirmation' });
        return skipped(context.error, context.order?.customerEmail ?? null);
      }
      const full = context.order.status === 'refunded' || context.order.tickets.every((ticket) => ticket.status === 'refunded' || ticket.status === 'void');
      const affected: EmailTicket[] = input.ticketIds?.length
        ? context.tickets.filter((ticket) => input.ticketIds!.includes(ticket.id))
        : full
          ? context.tickets
          : context.tickets.filter((ticket) => ticket.status === 'refunded');
      const rendered = await renderEmail('refund_confirmation', {
        brand: context.brand,
        customer: context.customer,
        event: context.event,
        order: context.emailOrder,
        refundCents: input.refundCents,
        tickets: affected.map((ticket) => ({ ...ticket, qrSrc: null })),
        full,
        status: input.status,
        reason: input.reason ?? null,
      });
      return deliver({ audience: 'guest', type: 'refund', template: 'refund_confirmation', to: context.order.customerEmail, rendered, orderId, eventId: context.order.eventId, refId: `${context.order.orderNumber}-refund-${REFUND_STATUS_TITLE[input.status]}-${input.refundCents}` });
    },

    /**
     * A change to one event, to every paid order on it. Cancellation is
     * `kind: 'cancelled'`, logged as `cancellation` so the refund email
     * knows to stand down. Returns what happened per order.
     */
    async sendEventUpdate(
      eventId: string,
      input: { kind: EventUpdateKind; message?: string | null; previous?: TemplateProps['event_update']['previous']; onlyOrderIds?: string[] },
    ): Promise<{ sent: number; skipped: number; failed: number; results: { orderId: string; orderNumber: string; result: SendResult }[] }> {
      const totals = { sent: 0, skipped: 0, failed: 0, results: [] as { orderId: string; orderNumber: string; result: SendResult }[] };
      const type: EmailLogType = input.kind === 'cancelled' ? 'cancellation' : 'event_update';
      // A cancellation reaches orders the register has already marked refunded
      // for it; any other update goes only to orders that are still live.
      const statuses = input.kind === 'cancelled' ? ['paid', 'partially_refunded', 'refunded'] : ['paid', 'partially_refunded'];
      const orders = (await deps.listPaidOrders(eventId, statuses)).filter((order) => !input.onlyOrderIds || input.onlyOrderIds.includes(order.id));
      for (const order of orders) {
        const result = await sendEventUpdateForOrder(order.id, { ...input, type });
        totals[result.status] += 1;
        totals.results.push({ orderId: order.id, orderNumber: order.orderNumber, result });
      }
      return totals;
    },

    sendEventUpdateForOrder,

    /** Wired, and switched off until somebody turns it on in Emails. */
    async sendThanksForComing(orderId: string, reviewUrl: string | null = null): Promise<SendResult> {
      if (!(await switchedOn('thanks_for_coming'))) return skipped('“Thanks for coming” is switched off in the admin.');
      const context = await orderContext(orderId, { qr: 'none' });
      if (context.error) return skipped(context.error, context.order?.customerEmail ?? null);
      const rendered = await renderEmail('thanks_for_coming', { brand: context.brand, customer: context.customer, event: context.event, reviewUrl });
      return deliver({ audience: 'guest', type: 'thanks', template: 'thanks_for_coming', to: context.order.customerEmail, rendered, orderId, eventId: context.order.eventId, refId: `${context.order.orderNumber}-thanks` });
    },

    /** A staff invitation with a link the caller already holds. Staff audience: no guest guard. */
    async sendStaffInvitation(input: Omit<StaffInvitationProps, 'brand'>): Promise<SendResult> {
      const brand = await deps.loadBrand();
      const rendered = await renderEmail('staff_invitation', { ...input, brand });
      return deliver({ audience: 'staff', type: 'staff_invitation', template: 'staff_invitation', to: input.email, rendered, refId: `invite-${input.email}-${Date.now()}` });
    },

    /**
     * One of the seven staff operations emails (welcome, schedule published,
     * shift changed, time-off decision, training required, document expiring,
     * event assignment). Staff audience: the guest delivery switch does not
     * apply, because nothing about this goes to a guest.
     */
    async sendStaffNotice(
      templateId: 'staff_welcome' | 'schedule_published' | 'shift_changed' | 'time_off_decision' | 'training_required' | 'document_expiring' | 'event_assignment',
      input: Omit<StaffEmailProps, 'brand'>,
      options: { refId?: string } = {},
    ): Promise<SendResult> {
      if (!(await switchedOn(templateId))) return skipped(`That staff email is switched off in the admin.`, input.email);
      const brand = await deps.loadBrand();
      const rendered = await renderEmail(templateId, { ...input, brand });
      const info = templateInfo(templateId)!;
      return deliver({ audience: 'staff', type: info.logType, template: templateId, to: input.email, rendered, refId: options.refId ?? `${templateId}-${input.email}-${Date.now()}` });
    },

    /** What the Supabase auth hook calls. Staff audience: sign-in must work before the guest switch is on. */
    async sendAuthEmail(payload: AuthHookPayload, context: { supabaseUrl: string; siteUrl: string; role?: string | null; invitedBy?: string | null }): Promise<SendResult> {
      const brand = await deps.loadBrand();
      const plan = planAuthEmail(payload, { brand, ...context });
      if (!plan.template) return skipped(plan.reason, payload.user.email);
      const rendered =
        plan.template === 'staff_invitation' ? await renderEmail('staff_invitation', plan.props) : await renderEmail(plan.template, plan.props);
      const info = templateInfo(plan.template)!;
      return deliver({ audience: 'staff', type: info.logType, template: plan.template, to: plan.to, rendered, refId: `auth-${payload.email_data.token_hash.slice(0, 12)}` });
    },

    /** Renders any template with real event data and fixture people, for the admin preview. Never sends. */
    async renderPreview(input: { templateId: TemplateId; variant?: string | null; eventId?: string | null; test?: boolean }): Promise<{ rendered: RenderedEmail; attachments: EmailAttachment[]; event: EmailEvent | null } | { error: string }> {
      const built = await buildTemplateProps(deps, input);
      if ('error' in built) return built;
      return { rendered: await renderEmail(built.templateId, built.props as never), attachments: built.attachments, event: built.event };
    },

    /**
     * A test send: real event, fixture guest, "[TEST]" in the subject and a
     * banner at the top. To exactly one address a signed-in manager typed.
     * Needs only the transport — the guest switch does not apply, because
     * nothing about this goes to a guest.
     */
    async sendTest(input: { templateId: TemplateId; variant?: string | null; eventId?: string | null; to: string }): Promise<SendResult> {
      const built = await buildTemplateProps(deps, { ...input, test: true });
      if ('error' in built) return skipped(built.error, input.to);
      const rendered = await renderEmail(built.templateId, built.props as never);
      const info = templateInfo(built.templateId)!;
      return deliver({ audience: 'staff', type: info.logType, template: built.templateId, to: input.to, rendered, eventId: input.eventId ?? null, attachments: built.attachments, isTest: true, refId: `test-${built.templateId}-${Date.now()}` });
    },

    /**
     * "We have your application." Guest audience, so it waits behind the
     * delivery switch like every other guest email — and the form reads the
     * result rather than promising an email that never left.
     */
    async sendApplicationReceived(input: { name: string; email: string; position: string; reference: string }): Promise<SendResult> {
      const brand = await deps.loadBrand();
      const rendered = await renderEmail('application_received', {
        brand,
        name: input.name,
        email: input.email,
        headline: 'We have your application.',
        intro: `Thanks for putting your name in. Somebody at ${brand.shortName} reads every one of these, and we will get in touch if it looks like a fit. If you would rather talk to a person, call us on ${brand.phone}.`,
        details: [
          { label: 'Applied for', value: input.position },
          { label: 'Reference', value: input.reference },
        ],
        note: null,
        actionUrl: brand.eventsUrl,
        actionLabel: 'See what is on at Cosa Nostra',
        footerReason: `Sent to ${input.email} because an application was sent from ${brand.siteUrl}/careers.`,
      });
      return deliver({ audience: 'guest', type: 'application_received', template: 'application_received', to: input.email, rendered, refId: `application-${input.reference}` });
    },

    /** "We got your work." Guest audience, same rules. */
    async sendTalentReceived(input: { name: string; email: string; pitch: string; reference: string }): Promise<SendResult> {
      const brand = await deps.loadBrand();
      const rendered = await renderEmail('talent_received', {
        brand,
        name: input.name,
        email: input.email,
        headline: 'We got it.',
        intro: `Thanks for showing us what you do. We will have a proper look and reach out if something feels like a fit — a night, a wall, a set, whatever suits. No news does not mean no: we keep everybody on this list.`,
        details: [
          { label: 'You sent', value: input.pitch },
          { label: 'Reference', value: input.reference },
        ],
        note: null,
        actionUrl: brand.eventsUrl,
        actionLabel: 'See what is on at Cosa Nostra',
        footerReason: `Sent to ${input.email} because you sent your work through ${brand.siteUrl}/talent.`,
      });
      return deliver({ audience: 'guest', type: 'talent_received', template: 'talent_received', to: input.email, rendered, refId: `talent-${input.reference}` });
    },

    /**
     * The internal nudge, to the alert address. Internal audience, so it is
     * not held behind the guest switch — the whole point is that the owner
     * finds out before the person does.
     */
    async sendSubmissionAlert(input: { kind: 'application' | 'talent'; headline: string; facts: [string, string][] }): Promise<SendResult> {
      if (!(await switchedOn('submission_alert'))) return skipped('The "somebody wrote in" email is switched off in the admin.');
      const to = deps.config().ownerAlertEmail;
      const brand = await deps.loadBrand();
      const hiring = input.kind === 'application';
      const rendered = await renderEmail('submission_alert', {
        brand,
        name: null,
        email: to ?? '',
        headline: hiring ? 'Somebody applied for a job.' : 'Somebody sent their work.',
        intro: input.headline,
        details: input.facts.map(([label, value]) => ({ label, value })),
        note: null,
        actionUrl: `${brand.siteUrl}${hiring ? '/admin/hiring' : '/admin/talent'}`,
        actionLabel: hiring ? 'Open applicants' : 'Open the talent book',
        footerReason: 'Sent to the Cosa Nostra alert address. Turn it off in Emails.',
      });
      return deliver({ audience: 'internal', type: 'submission_alert', template: 'submission_alert', to, rendered, refId: `submission-${input.kind}-${Date.now()}` });
    },

    /** A plain note to the owner. Internal audience. */
    async sendOwnerAlert(subject: string, body: string): Promise<SendResult> {
      const to = deps.config().ownerAlertEmail;
      const rendered: RenderedEmail = { subject: `[Cosa Nostra tickets] ${subject}`, html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(body)}</pre>`, text: body };
      return deliver({ audience: 'internal', type: 'owner_alert', template: null, to, rendered, refId: `alert-${Date.now()}` });
    },
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Props for any template from a real event and fixture people. Shared by
 * the preview and the test send so they cannot drift apart.
 */
async function buildTemplateProps(
  deps: EmailServiceDeps,
  input: { templateId: TemplateId; variant?: string | null; eventId?: string | null; test?: boolean },
): Promise<{ templateId: TemplateId; props: TemplateProps[TemplateId]; attachments: EmailAttachment[]; event: EmailEvent | null } | { error: string }> {
  const info = templateInfo(input.templateId);
  if (!info) return { error: 'Unknown template.' };
  const brand = await deps.loadBrand();
  const test = input.test ?? false;
  let event: EmailEvent | null = null;
  if (info.needsEvent) {
    if (!input.eventId) return { error: 'Pick an event for this email.' };
    event = await deps.loadEvent(input.eventId, { includeDrafts: true });
    if (!event) return { error: 'That event could not be found.' };
  }
  const variant = input.variant ?? null;
  const customer = fixtures.customer;
  const order = fixtures.threeTicketOrder;
  const withQr = await attachFixtureQrs(fixtures.threeTickets);

  switch (input.templateId) {
    case 'ticket_confirmation': {
      const direction: TicketDirection = variant === 'editorial' || variant === 'poster' || variant === 'pass' ? variant : deps.config().ticketDirection;
      return { templateId: input.templateId, event, attachments: withQr.attachments, props: { brand, customer, event: event!, order, tickets: withQr.tickets, direction, test } };
    }
    case 'event_reminder':
      return { templateId: input.templateId, event, attachments: withQr.attachments, props: { brand, customer, event: event!, order, tickets: withQr.tickets, timing: variant === 'tonight' ? 'tonight' : 'tomorrow', test } };
    case 'ticket_resend':
      return { templateId: input.templateId, event, attachments: withQr.attachments, props: { brand, customer, event: event!, order, tickets: withQr.tickets, test } };
    case 'refund_confirmation': {
      const partial = variant === 'partial';
      return {
        templateId: input.templateId,
        event,
        attachments: [],
        props: {
          brand,
          customer,
          event: event!,
          order: { ...order, refundedCents: partial ? 4500 : order.totalCents },
          refundCents: partial ? 4500 : order.totalCents,
          tickets: (partial ? fixtures.threeTickets.slice(1, 2) : fixtures.threeTickets).map((ticket) => ({ ...ticket, status: 'refunded' as const, qrSrc: null })),
          full: !partial,
          status: partial ? 'completed' : 'processing',
          reason: partial ? 'One guest could not make it — refunded at the register.' : null,
          test,
        },
      };
    }
    case 'event_update': {
      const kind = (['cancelled', 'time_change', 'date_change', 'venue_change', 'postponed', 'info'].includes(variant ?? '') ? variant : 'cancelled') as EventUpdateKind;
      const shifted = { ...event!, startsAt: new Date(Date.parse(event!.startsAt) + 3_600_000).toISOString(), endsAt: new Date(Date.parse(event!.endsAt) + 3_600_000).toISOString() };
      const props: TemplateProps['event_update'] = {
        brand,
        customer,
        event: kind === 'cancelled' ? { ...event!, status: 'cancelled' } : kind === 'time_change' || kind === 'date_change' ? shifted : event!,
        order,
        tickets: kind === 'cancelled' ? fixtures.threeTickets.map((ticket) => ({ ...ticket, status: 'void' as const, qrSrc: null })) : withQr.tickets,
        kind,
        previous: kind === 'time_change' || kind === 'date_change' ? { startsAt: event!.startsAt, endsAt: event!.endsAt } : null,
        message: kind === 'cancelled' ? 'We are sorry — this is a preview of the note staff can add when an event is cancelled.' : kind === 'info' ? 'This is where the update itself goes, in the staff member’s own words.' : null,
        refundCents: kind === 'cancelled' ? order.totalCents : null,
        test,
      };
      return { templateId: input.templateId, event, attachments: kind === 'cancelled' ? [] : withQr.attachments, props };
    }
    case 'thanks_for_coming':
      return { templateId: input.templateId, event, attachments: [], props: { brand, customer, event: event!, reviewUrl: null, test } };
    case 'staff_welcome':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.staffWelcome, brand, test } };
    case 'schedule_published':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.schedulePublished, brand, test } };
    case 'shift_changed':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.shiftChanged, brand, test } };
    case 'time_off_decision':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.timeOffDecision, brand, test } };
    case 'training_required':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.trainingRequired, brand, test } };
    case 'document_expiring':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.documentExpiring, brand, test } };
    case 'event_assignment':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.eventAssignment, brand, test } };
    case 'application_received':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.applicationReceived, brand, test } };
    case 'talent_received':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.talentReceived, brand, test } };
    case 'submission_alert':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.submissionAlert, brand, actionUrl: `${brand.siteUrl}/admin/talent`, test } };
    case 'staff_invitation':
      return { templateId: input.templateId, event: null, attachments: [], props: { ...fixtures.staffInvitation, brand, acceptUrl: `${brand.siteUrl}/auth/activate`, test } };
    case 'magic_link':
    case 'password_reset':
    case 'verify_email':
    case 'welcome':
      return { templateId: input.templateId, event: null, attachments: [], props: { brand, name: 'Nico Moretti', email: 'alex@example.com', actionUrl: `${brand.siteUrl}/auth/callback?code=preview`, expiresInMinutes: 60, test } };
    default:
      return { error: 'Unknown template.' };
  }
}

/** The tickets on an order the reminder cares about: at least one still unused. */
export function hasUnusedTicket(order: OrderRecord): boolean {
  return order.tickets.some((ticket) => ticket.status === 'valid');
}

async function listPaidOrders(eventId: string, statuses: string[]): Promise<OrderRecord[]> {
  const client = getTicketingClient();
  if (!client) return [];
  const { data } = await client.from('orders').select('id').eq('event_id', eventId).in('status', statuses).not('customer_email', 'is', null).limit(1000);
  const orders = await Promise.all(((data ?? []) as { id: string }[]).map((row) => getOrderById(String(row.id))));
  return orders.filter((order): order is OrderRecord => order !== null);
}

export const defaultEmailServiceDeps: EmailServiceDeps = {
  config: emailConfig,
  transport: resendTransport,
  store: emailStore,
  loadOrder: getOrderById,
  loadEvent: loadEmailEvent,
  loadBrand,
  listPaidOrders,
  buildTickets: ticketsToEmail,
  signingConfigured: isSigningConfigured,
  switches: emailSwitches,
  log: (message) => console.warn(`[email] ${message}`),
};

let instance: ReturnType<typeof createEmailService> | null = null;

/** The production service. Built lazily so importing this module has no side effects. */
export function getEmailService() {
  instance ??= createEmailService(defaultEmailServiceDeps);
  return instance;
}

export const emailService = {
  sendTicketConfirmation: (...args: Parameters<ReturnType<typeof createEmailService>['sendTicketConfirmation']>) => getEmailService().sendTicketConfirmation(...args),
  sendEventReminder: (...args: Parameters<ReturnType<typeof createEmailService>['sendEventReminder']>) => getEmailService().sendEventReminder(...args),
  sendTicketResend: (...args: Parameters<ReturnType<typeof createEmailService>['sendTicketResend']>) => getEmailService().sendTicketResend(...args),
  sendRefundConfirmation: (...args: Parameters<ReturnType<typeof createEmailService>['sendRefundConfirmation']>) => getEmailService().sendRefundConfirmation(...args),
  sendEventUpdate: (...args: Parameters<ReturnType<typeof createEmailService>['sendEventUpdate']>) => getEmailService().sendEventUpdate(...args),
  sendEventUpdateForOrder: (...args: Parameters<ReturnType<typeof createEmailService>['sendEventUpdateForOrder']>) => getEmailService().sendEventUpdateForOrder(...args),
  sendThanksForComing: (...args: Parameters<ReturnType<typeof createEmailService>['sendThanksForComing']>) => getEmailService().sendThanksForComing(...args),
  sendStaffInvitation: (...args: Parameters<ReturnType<typeof createEmailService>['sendStaffInvitation']>) => getEmailService().sendStaffInvitation(...args),
  sendStaffNotice: (...args: Parameters<ReturnType<typeof createEmailService>['sendStaffNotice']>) => getEmailService().sendStaffNotice(...args),
  sendApplicationReceived: (...args: Parameters<ReturnType<typeof createEmailService>['sendApplicationReceived']>) => getEmailService().sendApplicationReceived(...args),
  sendTalentReceived: (...args: Parameters<ReturnType<typeof createEmailService>['sendTalentReceived']>) => getEmailService().sendTalentReceived(...args),
  sendSubmissionAlert: (...args: Parameters<ReturnType<typeof createEmailService>['sendSubmissionAlert']>) => getEmailService().sendSubmissionAlert(...args),
  sendAuthEmail: (...args: Parameters<ReturnType<typeof createEmailService>['sendAuthEmail']>) => getEmailService().sendAuthEmail(...args),
  renderPreview: (...args: Parameters<ReturnType<typeof createEmailService>['renderPreview']>) => getEmailService().renderPreview(...args),
  sendTest: (...args: Parameters<ReturnType<typeof createEmailService>['sendTest']>) => getEmailService().sendTest(...args),
  sendOwnerAlert: (...args: Parameters<ReturnType<typeof createEmailService>['sendOwnerAlert']>) => getEmailService().sendOwnerAlert(...args),
};

export { EMAIL_TEMPLATES, INLINE_TICKET_LIMIT };
