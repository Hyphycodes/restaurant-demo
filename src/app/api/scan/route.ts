import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getStaff, staffCan } from '@/server/auth';
import { scanTicket } from '@/server/ticketing/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/scan — one scan, one verdict. Staff session required; the
 * existing Owner/Manager/Contributor auth is reused, nothing new.
 *
 * Two of the three ways in are a manager's judgement rather than a scan, and
 * are gated as such: letting somebody in on a duplicate (`override`), and
 * checking a ticket in by its id from search (`ticketId`, the dead-phone
 * case). Door staff scan and search; they do not decide.
 */
const schema = z
  .object({
    eventId: z.string().min(1).max(120),
    token: z.string().min(1).max(600).optional(),
    code: z.string().min(1).max(20).optional(),
    ticketId: z.string().uuid().optional(),
    override: z.boolean().optional(),
    deviceLabel: z.string().max(80).optional(),
    scannedAt: z.string().max(40).optional(),
  })
  .strict()
  .refine((value) => value.token || value.code || value.ticketId, { message: 'token, code or ticket' });

export async function POST(request: NextRequest) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Nothing to scan.' }, { status: 400 });

  const manager = staffCan(staff, 'content.publish');
  if ((parsed.data.override || parsed.data.ticketId) && !manager) {
    return NextResponse.json(
      { ok: false, message: 'A manager has to do that one. Ask whoever is running the night.' },
      { status: 403 },
    );
  }

  const response = await scanTicket({ ...parsed.data, scannedBy: staff.name || staff.email || staff.role });
  return NextResponse.json({ ok: true, ...response }, { headers: { 'cache-control': 'no-store' } });
}
