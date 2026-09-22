import { NextResponse } from 'next/server';
import { getStaff } from '@/server/auth';
import { canOpen } from '@/server/permissions';
import { listAttendees, toCsv } from '@/server/ticketing/sales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The attendee list as a file, because someone will want it on paper. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const staff = await getStaff();
  if (!staff || !canOpen({ role: staff.role, sections: staff.sections }, 'events')) {
    return new NextResponse('Not allowed', { status: 401 });
  }
  const { slug } = await context.params;
  const id = decodeURIComponent(slug);
  const csv = toCsv(await listAttendees(id));
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="attendees-${id.replace(/[^a-z0-9-]/gi, '_')}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
