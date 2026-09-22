import 'server-only';

import { emailService } from '@/server/email/service';

/**
 * What the webhook calls after its commit. Nothing here throws: every
 * outcome is a `SendResult` written to `email_log`, and a mailer problem is
 * retried from the tickets page or the admin, never surfaced as a failed
 * payment.
 */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  await emailService.sendTicketConfirmation(orderId);
}

export async function sendRefundConfirmation(orderId: string, refundCents: number, full: boolean): Promise<void> {
  await emailService.sendRefundConfirmation(orderId, {
    refundCents,
    status: 'processing',
    reason: full ? null : 'Part of this order was refunded. The tickets listed below are the ones affected.',
  });
}

export async function alertOwner(subject: string, body: string): Promise<void> {
  console.warn(`[alert] ${subject}\n${body}`);
  await emailService.sendOwnerAlert(subject, body);
}
