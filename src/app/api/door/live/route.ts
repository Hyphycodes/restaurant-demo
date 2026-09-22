import { NextResponse, type NextRequest } from 'next/server';
import { getStaff, staffCan } from '@/server/auth';
import { doorSnapshot } from '@/server/ticketing/insight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/door/live?eventId=…
 *
 * The count behind the door dashboard, polled every ten seconds. Money is in
 * the answer only for a manager or the owner — a door-role phone left on a
 * podium must not be showing the night's takings.
 */
export async function GET(request: NextRequest) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 401 });

  const eventId = request.nextUrl.searchParams.get('eventId')?.trim() ?? '';
  if (!eventId) return NextResponse.json({ ok: false, message: 'Which event?' }, { status: 400 });

  const snapshot = await doorSnapshot(eventId, { withMoney: staffCan(staff, 'content.publish') });
  return NextResponse.json({ ok: true, snapshot }, { headers: { 'cache-control': 'no-store' } });
}
