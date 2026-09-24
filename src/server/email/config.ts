import 'server-only';
import { DEMO_MODE } from '@/lib/demo';

import type { TicketDirection } from '@/emails/types';

/**
 * Everything the email system reads from the environment, in one place.
 *
 * Two switches matter and they are deliberately separate:
 *
 *   RESEND_API_KEY + ORDERS_FROM_EMAIL   can the site send email at all?
 *   EMAIL_DELIVERY_ENABLED=true          may it email GUESTS automatically?
 *
 * Deploying the code sets neither. A production deployment with the key in
 * place and the switch off logs every guest email as `skipped`, which is
 * the state this ships in: the infrastructure is live, the sending is not,
 * until the domain is verified and somebody flips the switch on purpose.
 *
 * Staff-initiated sends (a test email, a staff invitation, an owner alert)
 * need only the first pair — a manager typing an address into the admin is
 * the consent.
 */

export interface EmailConfig {
  /** RESEND_API_KEY is set. */
  transportConfigured: boolean;
  
  from: string | null;
  fromAddress: string | null;
  /** Why `from` is null, when it is. */
  fromProblem: string | null;
  replyTo: string | null;
  /** EMAIL_DELIVERY_ENABLED=true: guests may be emailed automatically. */
  deliveryEnabled: boolean;
  /** EMAIL_REDIRECT_ALL_TO: every guest email goes here instead. Staging. */
  redirectTo: string | null;
  ownerAlertEmail: string | null;
  /** RESEND_WEBHOOK_SECRET is set, so delivery events can be verified. */
  webhookSecretSet: boolean;
  /** SUPABASE_AUTH_HOOK_SECRET is set, so Supabase may ask this site to send auth emails. */
  authHookSecretSet: boolean;
  /** Which ticket-confirmation direction production sends. */
  ticketDirection: TicketDirection;
}

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailAddress(value: string | null | undefined): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value.trim()) && value.length <= 254;
}

export const DEFAULT_FROM_NAME = 'Casa Aurelia';

export function emailConfig(): EmailConfig {
  const fromAddress = env('ORDERS_FROM_EMAIL');
  let fromProblem: string | null = null;
  if (!fromAddress) fromProblem = 'ORDERS_FROM_EMAIL is not set.';
  else if (!isEmailAddress(fromAddress)) fromProblem = 'ORDERS_FROM_EMAIL is not a valid address.';
  else if (/@(resend\.dev|example\.com)$/i.test(fromAddress)) fromProblem = 'ORDERS_FROM_EMAIL must be on a domain the restaurant owns and has verified in Resend.';
  const fromName = env('EMAIL_FROM_NAME') ?? DEFAULT_FROM_NAME;
  const direction = env('EMAIL_TICKET_DIRECTION');
  const replyTo = env('EMAIL_REPLY_TO');
  const redirect = env('EMAIL_REDIRECT_ALL_TO');
  const owner = env('OWNER_ALERT_EMAIL');
  return {
    transportConfigured: !DEMO_MODE && Boolean(env('RESEND_API_KEY')),
    from: fromProblem ? null : `${fromName.replace(/[<>"]/g, '')} <${fromAddress}>`,
    fromAddress: fromProblem ? null : fromAddress,
    fromProblem,
    replyTo: isEmailAddress(replyTo) ? replyTo : null,
    deliveryEnabled: !DEMO_MODE && env('EMAIL_DELIVERY_ENABLED') === 'true',
    redirectTo: isEmailAddress(redirect) ? redirect : null,
    ownerAlertEmail: isEmailAddress(owner) ? owner : null,
    webhookSecretSet: Boolean(env('RESEND_WEBHOOK_SECRET')),
    authHookSecretSet: Boolean(env('SUPABASE_AUTH_HOOK_SECRET')),
    ticketDirection: direction === 'editorial' || direction === 'poster' || direction === 'pass' ? direction : 'pass',
  };
}
