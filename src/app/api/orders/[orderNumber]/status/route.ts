import { NextResponse, type NextRequest } from 'next/server';
import { verifyOrderToken } from '@/lib/ticketing/tokens';
import { getOrderByNumber, holdIsLive, isPaidStatus } from '@/server/ticketing/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/[orderNumber]/status?t=<token>
 *
 * What the tickets page polls while the webhook is on its way. The signed
 * token is required: an order number alone tells you nothing.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await context.params;
  const token = request.nextUrl.searchParams.get('t') ?? '';
  const orderId = token ? verifyOrderToken(token) : null;
  const order = await getOrderByNumber(orderNumber);
  if (!order || !orderId || orderId !== order.id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  return NextResponse.json(
    {
      ok: true,
      status: order.status,
      paid: isPaidStatus(order.status),
      holdLive: holdIsLive(order),
      tickets: order.tickets.length,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
