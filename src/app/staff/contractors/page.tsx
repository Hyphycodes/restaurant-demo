import { SearchField } from '@/components/admin/SearchField';
import { BookingForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Button, Empty, Pill, Row, Screen, Section } from '@/components/staff/ui';
import { CONTRACTOR_SERVICE_LABEL } from '@/content/staff-types';
import { formatPrice } from '@/lib/format';
import { formatDayShort } from '@/lib/staff/time';
import { listBookings, listContractors } from '@/server/staff/contractors';
import { eventOptionsFor, isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';


export default async function ContractorsPage({ searchParams }: { searchParams: Promise<{ q?: string; book?: string }> }) {
  const page = await staffPage('contractors.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const params = await searchParams;
  const [contractors, bookings, events] = await Promise.all([listContractors(db, { query: params.q }), listBookings(db, { from: new Date().toISOString() }), eventOptionsFor(db, context.location.timezone, 90)]);
  const upcoming = bookings.filter((booking) => booking.status !== 'cancelled').sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
  return (
    <StaffShell context={context} unread={unread} wide>
      <Screen title="Contractors" lead="One place for entertainment instead of text messages." actions={<Button href="/staff/contractors/new" variant="primary">Add contractor</Button>}>
        {params.book || contractors.length > 0 ? (
          <Section title="Book someone">
            <div className="staff-panel px-4 py-3">
              <BookingForm booking={null} contractors={contractors} events={events} defaultEventId={params.book ?? null} />
            </div>
          </Section>
        ) : null}
        <Section title="Coming up" count={upcoming.length}>
          {upcoming.length === 0 ? <p className="text-[0.875rem] text-brown-soft">No bookings coming up.</p> : (
            <div className="staff-panel px-4">
              {upcoming.map((booking) => (
                <Row key={booking.id} href={`/staff/contractors/${booking.contractorId}`} title={`${booking.contractorName} · ${booking.eventTitle ?? CONTRACTOR_SERVICE_LABEL[booking.role]}`} detail={`${booking.startsAt ? formatDayShort(booking.startsAt, context.location.timezone) : 'Date TBD'} · ${formatPrice(booking.agreedCents)} · ${booking.paymentStatus.replace('_', ' ')}`} trailing={<Pill tone={booking.status === 'confirmed' ? 'good' : 'neutral'}>{booking.status}</Pill>} />
              ))}
            </div>
          )}
        </Section>
        <Section title="Everyone" count={contractors.length}>
          <SearchField id="contractor-search" name="q" label="Search" placeholder="Name, company, phone" initial={params.q ?? ''} basePath="/staff/contractors" />
          {contractors.length === 0 ? <Empty title="No contractors yet." /> : (
            <div className="mt-3 staff-panel px-4">
              {contractors.map((contractor) => (
                <Row key={contractor.id} href={`/staff/contractors/${contractor.id}`} title={contractor.companyName ? `${contractor.name} · ${contractor.companyName}` : contractor.name} detail={`${CONTRACTOR_SERVICE_LABEL[contractor.serviceType]}${contractor.defaultRateCents ? ` · usually ${formatPrice(contractor.defaultRateCents)}` : ''} · ${contractor.phone ?? contractor.email ?? ''}`} trailing={<span className="flex gap-1">{contractor.upcomingBookings ? <Pill tone="accent">{contractor.upcomingBookings} upcoming</Pill> : null}{contractor.w9Status !== 'received' ? <Pill tone="warn">W-9 {contractor.w9Status}</Pill> : null}</span>} />
              ))}
            </div>
          )}
        </Section>
      </Screen>
    </StaffShell>
  );
}
