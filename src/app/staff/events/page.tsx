import Link from 'next/link';
import { NightBrief } from '@/components/staff/NightBrief';
import { StaffShell } from '@/components/staff/StaffShell';
import { Empty, Pill, Screen, Section } from '@/components/staff/ui';
import { STAFFING_ROLE_LABEL } from '@/content/staff-types';
import { formatDateRange, formatDayLong, weekOf, zonedDate, zonedInstant } from '@/lib/staff/time';
import { getSalesSummaries } from '@/server/ticketing/sales';
import { briefsFor } from '@/server/staff/briefs';
import { listEventsBetween } from '@/server/staff/events';
import { listShiftViews } from '@/server/staff/schedule';
import { eventStaffing } from '@/server/staff/staffing';
import { contextCan } from '@/server/staff/session';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

/**
 * The nights coming up.
 *
 * An employee sees what they would want to know before walking in: what is
 * on, when doors are, whether they are working it. A manager sees the same
 * list plus how staffed each night is and what it has taken — the extra
 * reads are not even issued for an employee, so there is nothing to leak.
 */
export default async function StaffEventsPage() {
  const page = await staffPage('events.view_brief');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const staffs = contextCan(context, 'events.staff');
  const seesMoney = contextCan(context, 'events.view_money');
  const now = new Date();
  const timezone = context.location.timezone;
  const events = await listEventsBetween(db, new Date(now.getTime() - 6 * 3_600_000).toISOString(), new Date(now.getTime() + 45 * 86_400_000).toISOString(), staffs ? null : context.location.id);

  const [briefs, staffingList, sales, myShifts] = await Promise.all([
    briefsFor(db, events.map((event) => event.id)),
    staffs ? Promise.all(events.map((event) => eventStaffing(db, event.id))) : Promise.resolve([]),
    seesMoney ? getSalesSummaries(events.map((event) => event.id)) : Promise.resolve(new Map()),
    context.employee
      ? listShiftViews(db, { from: now.toISOString(), to: zonedInstant(zonedDate(new Date(now.getTime() + 46 * 86_400_000), timezone), 0, timezone), employeeId: context.employee.id })
      : Promise.resolve([]),
  ]);
  const staffing = new Map(events.map((event, index) => [event.id, staffingList[index] ?? null]));
  const myRole = new Map(myShifts.filter((shift) => shift.eventId).map((shift) => [shift.eventId!, shift.positionName]));

  const thisWeekStart = weekOf(zonedDate(now, timezone))[0]!;
  const nextWeekStart = weekOf(zonedDate(new Date(now.getTime() + 7 * 86_400_000), timezone))[0]!;
  const weeks = new Map<string, typeof events>();
  for (const event of events) {
    const weekStart = weekOf(zonedDate(event.startsAt, timezone))[0]!;
    weeks.set(weekStart, [...(weeks.get(weekStart) ?? []), event]);
  }

  return (
    <StaffShell context={context} unread={unread} wide={staffs}>
      <Screen title="Events" lead={staffs ? 'The next six weeks. Tap a night to staff it.' : 'What’s coming up at Casa Aurelia.'}>
        {events.length === 0 ? <Empty title="Nothing on the calendar." detail={staffs ? 'Events are created in the admin; staffing and briefs happen here.' : 'No events coming up.'} /> : null}
        {Array.from(weeks.keys())
          .sort()
          .map((weekStart) => {
            const inWeek = weeks.get(weekStart)!;
            const label = weekStart === thisWeekStart ? 'This week' : weekStart === nextWeekStart ? 'Next week' : formatDateRange(weekStart, weekOf(weekStart)[6]!);
            return (
              <Section key={weekStart} title={label} count={inWeek.length}>
                <div className="grid gap-2">
                  {inWeek.map((event) => {
                    const board = staffing.get(event.id) ?? null;
                    const sold = sales.get(event.id)?.ticketsSold ?? null;
                    const brief = briefs.get(event.id) ?? null;
                    return (
                      <div key={event.id}>
                        <NightBrief
                          title={event.title}
                          subtitle={formatDayLong(event.startsAt, timezone)}
                          href={`/staff/events/${encodeURIComponent(event.id)}`}
                          startsAt={event.startsAt}
                          doorsAt={event.doorsAt}
                          timezone={timezone}
                          crowd={brief?.expectedGuests ?? sold}
                          crowdLabel={brief?.expectedGuests != null ? 'expected' : 'tickets out'}
                          brief={brief}
                          myRole={myRole.get(event.id) ?? null}
                          compact
                        />
                        {staffs && board ? (
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[0.8125rem] text-brown-soft">
                            {board.gaps.length > 0 ? <Pill tone="warn">{board.gaps.map((role) => STAFFING_ROLE_LABEL[role]).join(', ')} unassigned</Pill> : <Pill tone="good">Staffed</Pill>}
                            {board.assignments.map((assignment) => (
                              <span key={assignment.id}>
                                {STAFFING_ROLE_LABEL[assignment.role]}: {assignment.employeeName}
                              </span>
                            ))}
                            {board.bookings.map((booking) => (
                              <span key={booking.id}>
                                {booking.role}: {booking.contractorName}
                              </span>
                            ))}
                            {!event.published ? <span className="text-brown-soft/70">not on the website yet</span> : null}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Section>
            );
          })}
        {!staffs ? (
          <p className="text-[0.8125rem] text-brown-soft">
            Working one of these? It shows on{' '}
            <Link href="/staff/schedule" className="font-semibold text-brown underline underline-offset-4">
              your schedule
            </Link>
            .
          </p>
        ) : null}
      </Screen>
    </StaffShell>
  );
}
