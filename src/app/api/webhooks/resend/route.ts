import { NextResponse, type NextRequest } from 'next/server';
import { recordDeliveryEvent, type EmailLogStatus } from '@/server/email/log';
import { svixHeaders, verifyStandardWebhook } from '@/server/email/webhook-signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/resend
 *
 * What happened to an email after we handed it over: delivered, delayed,
 * bounced, marked as spam. Verified with RESEND_WEBHOOK_SECRET (Svix
 * signature), then written onto the `email_log` row by provider id. Opens
 * and clicks are ignored on purpose: nothing here tracks a guest.
 *
 * Always 200 for a verified event we do not care about, so Resend stops
 * retrying; 400 only for a bad signature or body; 503 until the secret is
 * set, which is the honest answer while the webhook is unconfigured.
 */

const STATUS: Record<string, EmailLogStatus> = {
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
};

interface ResendEvent {
  type: string;
  created_at?: string;
  data?: { email_id?: string; bounce?: { message?: string; type?: string; subType?: string }; failed?: { reason?: string } };
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false, message: 'RESEND_WEBHOOK_SECRET is not set.' }, { status: 503 });

  const body = await request.text();
  const verified = verifyStandardWebhook(body, svixHeaders((name) => request.headers.get(name)), secret);
  if (!verified.ok) return NextResponse.json({ ok: false, message: 'Bad signature.' }, { status: 400 });

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return NextResponse.json({ ok: false, message: 'Bad body.' }, { status: 400 });
  }

  const status = STATUS[event.type];
  const providerId = event.data?.email_id;
  if (!status || !providerId) return NextResponse.json({ ok: true, ignored: event.type });

  const detail =
    event.data?.bounce?.message ?? event.data?.failed?.reason ?? [event.data?.bounce?.type, event.data?.bounce?.subType].filter(Boolean).join('/') ?? null;
  const at = event.created_at && Number.isFinite(Date.parse(event.created_at)) ? new Date(event.created_at).toISOString() : new Date().toISOString();
  const matched = await recordDeliveryEvent(providerId, status, at, detail || null);
  return NextResponse.json({ ok: true, status, matched });
}
