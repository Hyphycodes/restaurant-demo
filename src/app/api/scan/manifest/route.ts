import { NextResponse, type NextRequest } from 'next/server';
import { getStaff } from '@/server/auth';
import { scanManifest } from '@/server/ticketing/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/scan/manifest?eventId= — the offline ticket set for one event. Staff only. */
export async function GET(request: NextRequest) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 401 });
  const eventId = request.nextUrl.searchParams.get('eventId') ?? '';
  if (!eventId) return NextResponse.json({ ok: false }, { status: 400 });
  const result = await scanManifest(eventId);
  if (!result) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, ...result }, { headers: { 'cache-control': 'no-store' } });
}
