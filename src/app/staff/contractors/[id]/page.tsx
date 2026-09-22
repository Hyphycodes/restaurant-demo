import { notFound } from 'next/navigation';
import { OneTap } from '@/components/staff/forms';
import { BookingForm, ContractorForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Chips, Facts, Pill, Screen, Section } from '@/components/staff/ui';
import { CONTRACTOR_SERVICE_LABEL } from '@/content/staff-types';
import { formatPrice } from '@/lib/format';
import { formatDayShort } from '@/lib/staff/time';
import { inviteContractor, markPaid } from '@/server/actions/staff/contractors';
import { getContractor, listBookings, listContractors } from '@/server/staff/contractors';
import { eventOptionsFor, isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

export default async function ContractorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; booking?: string }> }) {
  const page = await staffPage('contractors.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const { tab, booking: editBookingId } = await searchParams;
  const contractor = await getContractor(db, id);
  if (!contractor) notFound();
  const [bookings, events, all] = await Promise.all([listBookings(db, { contractorId: id }), eventOptionsFor(db, context.location.timezone, 120), listContractors(db, { includeInactive: true })]);
  const now = new Date().toISOString();
  const upcoming = bookings.filter((booking) => (booking.startsAt ?? '') >= now);
  const past = bookings.filter((booking) => !upcoming.includes(booking));
  const editing = editBookingId ? bookings.find((booking) => booking.id === editBookingId) ?? null : null;
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/contractors" label="Contractors" />
      <Screen title={contractor.name} eyebrow={`${CONTRACTOR_SERVICE_LABEL[contractor.serviceType]}${contractor.companyName ? ` · ${contractor.companyName}` : ''}`}>
        <Chips items={[{ href: `/staff/contractors/${id}`, label: 'Bookings', active: tab !== 'edit' }, { href: `/staff/contractors/${id}?tab=edit`, label: 'Details', active: tab === 'edit' }]} />
        {tab === 'edit' ? (
          <ContractorForm contractor={contractor} />
        ) : (
          <>
            <Facts
              items={[
                { label: 'Phone', value: contractor.phone ?? '—' },
                { label: 'Email', value: contractor.email ?? '—' },
                { label: 'Usual rate', value: contractor.defaultRateCents ? formatPrice(contractor.defaultRateCents) : '—' },
                { label: 'Paid by', value: contractor.paymentMethodNote ?? '—' },
                { label: 'W-9', value: <Pill tone={contractor.w9Status === 'received' ? 'good' : 'warn'}>{contractor.w9Status}</Pill> },
                { label: 'Past events', value: contractor.pastBookings },
              ]}
            />
            {contractor.notes ? <p className="whitespace-pre-line text-[0.9375rem] text-brown">{contractor.notes}</p> : null}
            <Section title="Their own view">
              <div className="staff-panel flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                <p className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed text-brown-soft">
                  {contractor.hasSignIn
                    ? 'They can sign in and see their bookings, arrival notes and payment status — nothing else of the restaurant.'
                    : 'Give them a sign-in and they can look up their own bookings, when to arrive and whether they have been paid. They see nothing else.'}
                </p>
                {contractor.hasSignIn ? (
                  <Pill tone="good">Has a sign-in</Pill>
                ) : (
                  <OneTap action={inviteContractor} fields={{ id }} variant="secondary" confirm={`Email ${contractor.email ?? 'them'} a sign-in for their own bookings?`}>
                    Invite them
                  </OneTap>
                )}
              </div>
            </Section>
            <Section title={editing ? 'Edit booking' : 'New booking'} action={editing ? <a href={`/staff/contractors/${id}`} className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">New instead</a> : undefined}>
              <div className="staff-panel px-4 py-3">
                <BookingForm key={editing?.id ?? 'new'} booking={editing} contractors={all} events={events} defaultContractorId={id} />
              </div>
            </Section>
            {[{ title: 'Upcoming', list: upcoming }, { title: 'Past', list: past }].map(({ title, list }) =>
              list.length > 0 ? (
                <Section key={title} title={title} count={list.length}>
                  <div className="staff-panel px-4">
                    {list.map((booking) => (
                      <div key={booking.id} className="staff-row flex-wrap">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.9375rem] font-semibold text-brown">
                            {booking.eventTitle ?? CONTRACTOR_SERVICE_LABEL[booking.role]} · {booking.startsAt ? formatDayShort(booking.startsAt, context.location.timezone) : 'date TBD'}
                          </span>
                          <span className="block text-[0.8125rem] text-brown-soft">
                            {formatPrice(booking.agreedCents)} agreed{booking.depositCents ? ` · ${formatPrice(booking.depositCents)} deposit` : ''} · {formatPrice(booking.paidCents)} paid{booking.paidOn ? ` on ${booking.paidOn}` : ''}
                            {booking.paymentNote ? ` · ${booking.paymentNote}` : ''}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Pill tone={booking.status === 'confirmed' || booking.status === 'completed' ? 'good' : booking.status === 'cancelled' ? 'bad' : 'neutral'}>{booking.status}</Pill>
                          <Pill tone={booking.paymentStatus === 'paid' ? 'good' : booking.paymentStatus === 'deposit_paid' ? 'accent' : 'warn'}>{booking.paymentStatus.replace('_', ' ')}</Pill>
                          {booking.paymentStatus !== 'paid' && booking.agreedCents > 0 && booking.status !== 'cancelled' ? (
                            <OneTap action={markPaid} fields={{ id: booking.id }} variant="quiet" quiet confirm={`Mark ${formatPrice(booking.agreedCents)} as paid?`}>
                              Mark paid
                            </OneTap>
                          ) : null}
                          <a href={`/staff/contractors/${id}?booking=${booking.id}`} className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">
                            Edit
                          </a>
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null,
            )}
          </>
        )}
      </Screen>
    </StaffShell>
  );
}
