import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '@/server/actions/team';
import { CONTRACTOR_SERVICE_LABEL } from '@/content/staff-types';
import { Empty, Pill, Screen, Section } from '@/components/staff/ui';
import { PreviewBanner } from '@/components/staff/PreviewBanner';
import { formatClockShort, formatDayLong } from '@/lib/staff/time';
import { listBookings } from '@/server/staff/contractors';
import { opsReadDb } from '@/server/staff/db';
import { eventSummaries } from '@/server/staff/events';
import { listLocations } from '@/server/staff/locations';
import { getStaffContext } from '@/server/staff/session';

export const dynamic = 'force-dynamic';

/**
 * The contractor's whole app.
 *
 * A DJ signing in wants four things: when, where, what you need me to do,
 * and have I been paid. They are not employees, so nothing of the
 * restaurant's operation is reachable from here — no schedule, no team, no
 * training, no other bookings, not even a nav bar, because there is nowhere
 * else to go. The `contractors.view_self` capability is the only one their
 * account carries, and every row is filtered to their own contractor id
 * before it reaches this screen.
 */
export default async function ContractorBookingsPage() {
  const context = await getStaffContext();
  if (!context) redirect('/admin/login?next=/staff/bookings');
  // Anyone who is not a contractor belongs in the employee app.
  if (context.opsRole !== 'contractor') redirect('/staff');
  const db = opsReadDb();
  const contractor = context.contractor;

  if (!db || !contractor) {
    // An owner previewing as a contractor lands here too, and would otherwise
    // be stuck in a frame with no way back — the preview banner is part of the
    // employee shell, which this screen deliberately does not use.
    const previewing = context.previewing === 'contractor';
    return (
      <ContractorFrame name={context.staff.name} previewing={previewing}>
        <Screen title={previewing ? 'A contractor with no bookings' : 'Almost there'}>
          <Empty
            title={previewing ? 'This is everything a contractor can open.' : 'Your account isn’t linked to a booking profile yet.'}
            detail={
              previewing
                ? 'No schedule, no team, no training — one screen, and only their own bookings on it. Your own account is unchanged.'
                : 'Reply to whoever booked you and they’ll connect it. Nothing is lost.'
            }
          />
        </Screen>
      </ContractorFrame>
    );
  }

  const bookings = await listBookings(db, { contractorId: contractor.id });
  const [events, locations] = await Promise.all([
    eventSummaries(db, bookings.map((booking) => booking.eventId).filter((id): id is string => Boolean(id))),
    listLocations(db),
  ]);
  const now = Date.now();
  const upcoming = bookings.filter((booking) => booking.status !== 'cancelled' && booking.startsAt && Date.parse(booking.startsAt) >= now - 6 * 3_600_000).sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
  const past = bookings.filter((booking) => !upcoming.includes(booking)).sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''));
  const zoneOf = (locationId: string | null) => locations.find((entry) => entry.id === locationId)?.timezone ?? locations[0]?.timezone ?? 'America/Chicago';
  const venueOf = (locationId: string | null) => locations.find((entry) => entry.id === locationId)?.name ?? locations[0]?.name ?? 'Cosa Nostra';

  return (
    <ContractorFrame name={contractor.name} previewing={context.previewing === 'contractor'}>
      <Screen title={`Hi, ${contractor.name.split(/\s+/)[0]}`} eyebrow="Your bookings at Cosa Nostra" lead={contractor.companyName ?? CONTRACTOR_SERVICE_LABEL[contractor.serviceType]}>
        <Section title="Coming up">
          {upcoming.length === 0 ? (
            <Empty title="Nothing booked right now." detail="When Cosa Nostra books you, it shows up here with the details." />
          ) : (
            <div className="grid gap-3">
              {upcoming.map((booking) => {
                const event = booking.eventId ? events.get(booking.eventId) ?? null : null;
                const timezone = zoneOf(booking.locationId);
                return (
                  <article key={booking.id} className="staff-panel border-amber/40 px-5 py-4">
                    <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-amber">{booking.status === 'confirmed' ? 'Confirmed' : booking.status === 'tentative' ? 'Pencilled in' : booking.status}</p>
                    <h3 className="display mt-1 text-[1.5rem] leading-tight text-brown">{event?.title ?? CONTRACTOR_SERVICE_LABEL[booking.role]}</h3>
                    <p className="mt-1 text-[1.0625rem] text-brown">
                      {booking.startsAt ? formatDayLong(booking.startsAt, timezone) : 'Date to be confirmed'}
                      {booking.startsAt ? ` · ${formatClockShort(booking.startsAt, timezone)}` : ''}
                      {booking.endsAt ? ` – ${formatClockShort(booking.endsAt, timezone)}` : ''}
                    </p>
                    <p className="text-[0.9375rem] text-brown-soft">{venueOf(booking.locationId)}</p>
                    {event?.doorsAt ? <p className="mt-1 text-[0.875rem] text-brown-soft">Doors {formatClockShort(event.doorsAt, timezone)}</p> : null}
                    {booking.arrivalNote ? (
                      <div className="mt-3 rounded-(--radius-sm) bg-brown/8 px-3 py-2.5">
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-brown-soft">When you arrive</p>
                        <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-brown">{booking.arrivalNote}</p>
                      </div>
                    ) : null}
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.875rem] text-brown-soft">
                      <Pill tone={booking.paymentStatus === 'paid' ? 'good' : booking.paymentStatus === 'deposit_paid' ? 'accent' : 'neutral'}>
                        {booking.paymentStatus === 'paid' ? 'Paid' : booking.paymentStatus === 'deposit_paid' ? 'Deposit paid' : 'Not paid yet'}
                      </Pill>
                      {booking.paymentNote ? <span>{booking.paymentNote}</span> : null}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </Section>

        {contractor.w9Status !== 'received' ? (
          <Section title="Paperwork">
            <div className="staff-panel px-4 py-3.5">
              <p className="text-[0.9375rem] text-brown">We still need a W-9 from you before payment.</p>
              <p className="mt-1 text-[0.875rem] text-brown-soft">Send it to whoever booked you and this will update.</p>
            </div>
          </Section>
        ) : null}

        {past.length > 0 ? (
          <Section title="Past bookings">
            <div className="staff-panel px-4">
              {past.slice(0, 12).map((booking) => {
                const event = booking.eventId ? events.get(booking.eventId) ?? null : null;
                return (
                  <div key={booking.id} className="staff-row">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-semibold text-brown">{event?.title ?? CONTRACTOR_SERVICE_LABEL[booking.role]}</span>
                      <span className="block text-[0.8125rem] text-brown-soft">{booking.startsAt ? formatDayLong(booking.startsAt, zoneOf(booking.locationId)) : 'No date'}</span>
                    </span>
                    <Pill tone={booking.paymentStatus === 'paid' ? 'good' : 'warn'}>{booking.paymentStatus === 'paid' ? 'Paid' : 'Outstanding'}</Pill>
                  </div>
                );
              })}
            </div>
          </Section>
        ) : null}

        <p className="text-[0.875rem] text-brown-soft">
          Questions about a booking? Reply to the person who booked you, or call{' '}
          <Link href="tel:+13125550147" className="font-semibold text-brown underline underline-offset-4">
            (312) 555-0147
          </Link>
          .
        </p>
      </Screen>
    </ContractorFrame>
  );
}

/** A header and nothing else: there is exactly one screen to be on. */
function ContractorFrame({ name, previewing = false, children }: { name: string; previewing?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ivory">
      <header className="sticky top-0 z-40 border-b border-night-text/10 bg-teal">
        <div className="mx-auto flex max-w-[720px] items-center gap-4 px-4 py-2.5 sm:px-6">
          <span className="display shrink-0 text-[1.375rem] leading-none text-night-text">
            Cosa Nostra
            <span className="ml-1.5 font-sans text-[0.75rem] font-medium normal-case tracking-[0.12em] text-night-text/55">bookings</span>
          </span>
          <span className="ml-auto flex items-center gap-3 text-[0.8125rem]">
            <span className="hidden truncate text-night-text/55 sm:block">{name}</span>
            <form action={signOut}>
              <button type="submit" className="inline-flex min-h-10 items-center text-night-text/55 underline-offset-4 hover:text-night-text hover:underline">
                Sign out
              </button>
            </form>
          </span>
        </div>
      </header>
      {previewing ? <PreviewBanner role="Contractor" /> : null}
      <main className="mx-auto max-w-[720px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
