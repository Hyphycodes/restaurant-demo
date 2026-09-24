import { NextResponse } from 'next/server';
import { getStaff, staffCan } from '@/server/auth';
import { listCustomers } from '@/server/ticketing/insight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /admin/customers/export
 *
 * Opted-in contacts only, by default and by design: the export exists to be
 * pasted into a mailing tool, and everyone in it has agreed to that. The full
 * list stays on the screen, where it is a lookup rather than a mailing list.
 */
export async function GET() {
  const staff = await getStaff();
  if (!staff || !staffCan(staff, 'content.publish')) {
    return new NextResponse('Not allowed', { status: 403 });
  }

  const customers = (await listCustomers('', 5000)).filter((customer) => customer.marketingOptIn);
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const rows = [
    ['email', 'name', 'phone', 'tickets', 'nights', 'spend', 'first_seen', 'last_seen'].join(','),
    ...customers.map((customer) =>
      [
        customer.email,
        customer.name ?? '',
        customer.phone ?? '',
        String(customer.tickets),
        String(customer.events),
        (customer.spendCents / 100).toFixed(2),
        customer.firstSeenAt.slice(0, 10),
        customer.lastSeenAt.slice(0, 10),
      ]
        .map(escape)
        .join(','),
    ),
  ].join('\n');

  return new NextResponse(rows, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="casa-aurelia-customers-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
