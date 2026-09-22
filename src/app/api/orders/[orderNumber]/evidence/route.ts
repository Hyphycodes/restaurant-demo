import { NextResponse } from 'next/server';
import { getStaff, staffCan } from '@/server/auth';
import { disputeEvidence } from '@/server/ticketing/insight';
import { getOrderByNumber } from '@/server/ticketing/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/[orderNumber]/evidence — everything Stripe's dispute form
 * asks for, as text to paste. Manager and owner only: it contains the
 * customer's details and what they paid.
 *
 * Keyed by order number, like every other route under /api/orders. Next
 * refuses two different slug names at the same path, and more to the point the
 * order number is what a human reads off a Stripe dispute.
 */
export async function GET(_request: Request, context: { params: Promise<{ orderNumber: string }> }) {
  const staff = await getStaff();
  if (!staff || !staffCan(staff, 'content.publish')) return NextResponse.json({ ok: false }, { status: 403 });

  const { orderNumber } = await context.params;
  const order = await getOrderByNumber(orderNumber);
  const evidence = order ? await disputeEvidence(order.id) : null;
  if (!evidence) return NextResponse.json({ ok: false, message: 'That order could not be found.' }, { status: 404 });
  return NextResponse.json({ ok: true, evidence }, { headers: { 'cache-control': 'no-store' } });
}
