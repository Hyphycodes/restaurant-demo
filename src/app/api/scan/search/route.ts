import { NextResponse, type NextRequest } from 'next/server';
import { getStaff, staffCan } from '@/server/auth';
import { searchAttendees } from '@/server/ticketing/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/scan/search?eventId=…&q=…
 *
 * The dead-phone case: find a guest by name, order number or ticket code and
 * let them in. Email is searchable and shown only for a manager — door staff
 * need to find somebody, not to be handed the customer list.
 */
export async function GET(request: NextRequest) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 401 });

  const eventId = request.nextUrl.searchParams.get('eventId')?.trim() ?? '';
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!eventId || query.length < 2) return NextResponse.json({ ok: true, matches: [] });

  const matches = await searchAttendees(eventId, query, { withEmail: staffCan(staff, 'content.publish') });
  return NextResponse.json({ ok: true, matches }, { headers: { 'cache-control': 'no-store' } });
}
