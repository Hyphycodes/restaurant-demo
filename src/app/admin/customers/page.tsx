import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, EmptyState, HelpNote, LinkButton } from '@/components/admin/ui';
import { SearchField } from '@/components/admin/SearchField';
import { isLocalDb } from '@/lib/db';
import { formatPrice } from '@/lib/format';
import { getStaff, staffCan } from '@/server/auth';
import { listCustomers } from '@/server/ticketing/insight';

export const dynamic = 'force-dynamic';

/**
 * Everyone who has ever bought a ticket.
 *
 * This is the asset the ticketing company used to own. It is deliberately a
 * manager-and-owner screen: door staff need to find one guest at a door, not
 * to hold the list.
 */
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();

  if (!staffCan(staff, 'content.publish')) {
    return (
      <AdminShell staff={staff} local={local} title="Customers">
        <NoAccess what="the customer list" />
      </AdminShell>
    );
  }

  const { q } = await searchParams;
  const customers = await listCustomers(q ?? '');
  const optedIn = customers.filter((customer) => customer.marketingOptIn).length;

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Customers"
      description="Everyone who has bought a ticket, and what they have spent."
      actions={
        <LinkButton href="/admin/customers/export" variant="secondary">
          Export opted-in CSV
        </LinkButton>
      }
    >
      <div className="grid gap-5">
        <Card>
          <SearchField
            id="customer-search"
            name="q"
            label="Find someone"
            placeholder="Name, email or phone"
            initial={q ?? ''}
            basePath="/admin/customers"
          />
          <p className="mt-3 text-[0.9375rem] text-brown-soft">
            {customers.length} {customers.length === 1 ? 'person' : 'people'}
            {q ? ' matching' : ''} · {optedIn} agreed to hear from you
          </p>
          <HelpNote>
            Emailing or texting this list for marketing needs their permission. The export gives you
            only the people who gave it; everyone else is here so you can look someone up, not so
            they can be mailed.
          </HelpNote>
        </Card>

        {customers.length === 0 ? (
          <EmptyState>
            {q ? 'Nobody matches that.' : 'Nobody has bought a ticket yet. This fills itself as tickets sell.'}
          </EmptyState>
        ) : (
          <Card tone="quiet">
            <ul className="divide-y divide-brown/10">
              {customers.map((customer) => (
                <li key={customer.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[1rem] font-semibold text-brown">{customer.name ?? customer.email}</p>
                    <p className="truncate text-[0.875rem] text-brown-soft">
                      {customer.email}
                      {customer.phone ? ` · ${customer.phone}` : ''}
                      {customer.marketingOptIn ? ' · opted in' : ''}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-[0.9375rem] text-brown">
                    {customer.tickets} {customer.tickets === 1 ? 'ticket' : 'tickets'} · {customer.events}{' '}
                    {customer.events === 1 ? 'night' : 'nights'} · {formatPrice(customer.spendCents)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
