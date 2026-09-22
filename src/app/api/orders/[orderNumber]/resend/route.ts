import { NextResponse, type NextRequest } from 'next/server';
import { verifyOrderToken } from '@/lib/ticketing/tokens';
import { getStaff } from '@/server/auth';
import { emailService } from '@/server/email/service';
import { getOrderByNumber, isPaidStatus } from '@/server/ticketing/orders';
import { overLimit } from '@/server/ticketing/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/[orderNumber]/resend
 *
 * "Email these to me again." Allowed to the guest holding the signed link
 * and to signed-in staff; three per order every ten minutes.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await context.params;
  const order = await getOrderByNumber(orderNumber);
  if (!order) return NextResponse.json({ ok: false, message: 'That order could not be found.' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { t?: string };
  const byToken = typeof body.t === 'string' && verifyOrderToken(body.t) === order.id;
  const staff = byToken ? null : await getStaff();
  if (!byToken && !staff) return NextResponse.json({ ok: false }, { status: 401 });

  if (!isPaidStatus(order.status)) {
    return NextResponse.json({ ok: false, message: 'This order has no valid tickets to send.' }, { status: 409 });
  }
  if (await overLimit(`resend:${order.id}`, 3, 600)) {
    return NextResponse.json({ ok: false, message: 'Already sent a few times. Check your spam folder, then try again in ten minutes.' }, { status: 429 });
  }

  const result = await emailService.sendTicketResend(order.id);
  // Staff see the real reason; a guest gets one sentence and their tickets are still on the page.
  return NextResponse.json(
    result.ok
      ? { ok: true, message: `Sent to ${order.customerEmail}.` }
      : { ok: false, message: staff && result.reason ? `Not sent: ${result.reason}` : 'Could not send just now. Your tickets are still on this page.' },
    { status: result.ok ? 200 : 502 },
  );
}
