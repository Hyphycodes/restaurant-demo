import 'server-only';

import { isSigningConfigured } from '@/lib/ticketing/tokens';
import { getTicketingClient } from './db';

/**
 * What is connected, and what each missing piece costs.
 *
 * Read on the server, reported as booleans and one public hostname. **No value
 * of any key ever leaves this module** — the question a person needs answered
 * is "is it set", never "what is it".
 */

export type ReadinessState = 'ready' | 'partial' | 'missing';

export interface ReadinessItem {
  id: string;
  title: string;
  state: ReadinessState;
  /** What works, or does not, because of this. */
  consequence: string;
  /** The variables involved, and whether each one is present. */
  vars: { name: string; set: boolean }[];
  /** What to do about it, in order. */
  steps: string[];
  /** Safe to show: a hostname that is already in the browser bundle. */
  detail?: string;
}

function has(name: string): boolean {
  return (process.env[name]?.trim().length ?? 0) > 0;
}

function state(required: string[], optional: string[] = []): ReadinessState {
  const set = required.filter(has).length;
  if (set === 0) return 'missing';
  if (set < required.length) return 'partial';
  return optional.every(has) ? 'ready' : 'partial';
}

/** The Supabase project this deployment talks to, from its public URL. */
export function supabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Has migration 0015 been applied? Answered by asking for a row, not by guessing. */
export async function customersTableExists(): Promise<boolean | null> {
  const client = getTicketingClient();
  if (!client) return null;
  const { error } = await client.from('customers').select('id', { head: true, count: 'exact' }).limit(1);
  if (!error) return true;
  // 42P01 = undefined_table. Anything else (a network blip, a permission
  // oddity) is "do not know" rather than "not applied".
  return error.code === '42P01' ? false : null;
}

export async function readiness(): Promise<ReadinessItem[]> {
  const host = supabaseHost();
  const customers = await customersTableExists();

  const items: ReadinessItem[] = [
    {
      id: 'database',
      title: 'Database',
      state: state(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']),
      consequence:
        'Without it the site still serves every page from the code, but nothing can be edited here and no ticket can be sold.',
      vars: [
        { name: 'NEXT_PUBLIC_SUPABASE_URL', set: has('NEXT_PUBLIC_SUPABASE_URL') },
        { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', set: has('NEXT_PUBLIC_SUPABASE_ANON_KEY') },
        { name: 'SUPABASE_SERVICE_ROLE_KEY', set: has('SUPABASE_SERVICE_ROLE_KEY') },
      ],
      steps: [
        'Supabase → Project settings → API has all three values.',
        'Vercel → Settings → Environment Variables, Production and Preview.',
        'Never prefix the service role key with NEXT_PUBLIC_.',
      ],
      detail: host ? `Connected to ${host}` : undefined,
    },
    {
      id: 'migrations',
      title: 'Database is up to date',
      state: customers === true ? 'ready' : customers === false ? 'missing' : 'partial',
      consequence:
        customers === false
          ? 'The customer list, promoter codes and the newer scan results are not in the database yet. Everything else works.'
          : customers === null
            ? 'Could not be checked, because the database is not reachable from here.'
            : 'Every migration in the repository has been applied.',
      vars: [],
      steps:
        customers === false
          ? [
              'Open Supabase → SQL editor.',
              'Paste supabase/migrations/0015_customers_and_promoter_attribution.sql and run it.',
              'Reload this page; it should turn green.',
            ]
          : [],
    },
    {
      id: 'stripe',
      title: 'Card payments',
      state: state(['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'], ['STRIPE_WEBHOOK_SECRET']),
      consequence:
        'Until this is connected, choosing tickets still reaches checkout, but the page says card payments are not switched on and asks the guest to call.',
      vars: [
        { name: 'STRIPE_SECRET_KEY', set: has('STRIPE_SECRET_KEY') },
        { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', set: has('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY') },
        { name: 'STRIPE_WEBHOOK_SECRET', set: has('STRIPE_WEBHOOK_SECRET') },
      ],
      steps: [
        'Create the Stripe account in the restaurant’s name and connect its bank account.',
        'Developers → API keys: copy the secret and publishable keys.',
        'Developers → Webhooks: add https://…/api/webhooks/stripe and copy its signing secret.',
        'Add all three in Vercel, then redeploy. docs/stripe-setup.md has the full checklist.',
      ],
    },
    {
      id: 'signing',
      title: 'Ticket signing',
      state: isSigningConfigured() ? 'ready' : 'missing',
      consequence:
        'QR codes and ticket links are signed with this. Without it no ticket can be issued, and changing it later invalidates every ticket already sent.',
      vars: [{ name: 'TICKET_SIGNING_SECRET', set: has('TICKET_SIGNING_SECRET') }],
      steps: [
        'Generate 32+ random characters (openssl rand -base64 32).',
        'Add it in Vercel as TICKET_SIGNING_SECRET and keep a copy somewhere safe.',
      ],
    },
    {
      id: 'email',
      title: 'Email sending',
      state: state(['RESEND_API_KEY', 'ORDERS_FROM_EMAIL'], ['OWNER_ALERT_EMAIL', 'RESEND_WEBHOOK_SECRET']),
      consequence:
        'Tickets are still issued and still scannable from the ticket page; nothing can be emailed — not tickets, not test emails, not staff invitations — and the owner gets no alert about a dispute or a failed refund.',
      vars: [
        { name: 'RESEND_API_KEY', set: has('RESEND_API_KEY') },
        { name: 'ORDERS_FROM_EMAIL', set: has('ORDERS_FROM_EMAIL') },
        { name: 'OWNER_ALERT_EMAIL', set: has('OWNER_ALERT_EMAIL') },
        { name: 'RESEND_WEBHOOK_SECRET', set: has('RESEND_WEBHOOK_SECRET') },
      ],
      steps: [
        'Create the Resend account and verify a sending subdomain (tickets.casaaurelia.example).',
        'Add its SPF, DKIM and DMARC records at the registrar.',
        'Add RESEND_API_KEY, ORDERS_FROM_EMAIL and OWNER_ALERT_EMAIL in Vercel.',
        'Add a Resend webhook for https://…/api/webhooks/resend and put its signing secret in RESEND_WEBHOOK_SECRET. docs/email-system.md has the full checklist.',
      ],
    },
    {
      id: 'email-delivery',
      title: 'Emailing guests',
      state: process.env.EMAIL_DELIVERY_ENABLED?.trim() === 'true' ? 'ready' : 'missing',
      consequence:
        process.env.EMAIL_DELIVERY_ENABLED?.trim() === 'true'
          ? 'Guests are emailed their tickets, reminders, refunds and event changes automatically.'
          : 'Deliberately off. Every guest email is logged as skipped in Communications instead of being sent; test emails and staff invitations still work. Turn it on only once the sending domain is verified.',
      vars: [{ name: 'EMAIL_DELIVERY_ENABLED', set: process.env.EMAIL_DELIVERY_ENABLED?.trim() === 'true' }],
      steps: ['Send yourself a test from Communications and check it lands in the inbox, not spam.', 'Set EMAIL_DELIVERY_ENABLED=true in Vercel and redeploy.'],
    },
    {
      id: 'cron',
      title: 'Scheduled jobs',
      state: has('CRON_SECRET') ? 'ready' : 'missing',
      consequence:
        'Expired holds are released by every reservation anyway, so seats never stay stuck — but the five-minute tidy-up and the day-before reminder do not run.',
      vars: [{ name: 'CRON_SECRET', set: has('CRON_SECRET') }],
      steps: ['Generate any long random string and add it in Vercel as CRON_SECRET.'],
    },
  ];

  return items;
}

/** One line for the top of the page. */
export function readinessSummary(items: ReadinessItem[]): { ready: number; total: number; blocking: string[] } {
  const blocking = items.filter((item) => item.state !== 'ready').map((item) => item.title);
  return { ready: items.length - blocking.length, total: items.length, blocking };
}
