import { notFound } from 'next/navigation';
import { Comments } from '@/components/staff/Comments';
import { EventStaffingPanel } from '@/components/staff/EventStaffingPanel';
import { BriefForm } from '@/components/staff/manage/BriefForm';
import { NightBrief } from '@/components/staff/NightBrief';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Button, Empty, Facts, Screen, Section } from '@/components/staff/ui';
import { formatClockShort, formatDayLong, formatPrice } from '@/components/staff/format';
import { getSalesSummaries } from '@/server/ticketing/sales';
import { getBrief } from '@/server/staff/briefs';
import { listComments } from '@/server/staff/comments';
import { listEmployees } from '@/server/staff/employees';
import { getEventLite } from '@/server/staff/events';
import { locationMap, resolveLocation } from '@/server/staff/locations';
import { listShiftViews } from '@/server/staff/schedule';
import { eventStaffing } from '@/server/staff/staffing';
import { contextCan } from '@/server/staff/session';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

/**
 * One night.
 *
 * The same URL for everyone, and what is on it is decided by capability.
 * An employee gets the brief and their own assignment. A manager gets the
 * brief they write, the staffing board, and — only with `events.view_money`
 * — what the night has taken. The money read is not issued at all otherwise:
 * a screen cannot leak a number it was never handed.
 */
export default async function StaffEventPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await staffPage('events.view_brief');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const eventId = decodeURIComponent(id);
  const staffs = contextCan(context, 'events.staff');
  const seesMoney = contextCan(context, 'events.view_money');

  const event = await getEventLite(db, eventId);
  if (!event) notFound();
  const locations = await locationMap(db);
  const location = resolveLocation(locations, event.locationId ?? context.location.id);
  const timezone = location.timezone;

  // An employee may open a night at a location they do not work at only if
  // they are actually on it. Otherwise it is not their business.
  const myShifts = context.employee ? await listShiftViews(db, { from: new Date(Date.parse(event.startsAt) - 86_400_000).toISOString(), to: new Date(Date.parse(event.startsAt) + 2 * 86_400_000).toISOString(), employeeId: context.employee.id }) : [];
  const mine = myShifts.find((shift) => shift.eventId === eventId) ?? null;
  if (!staffs && !mine && !context.locations.some((entry) => entry.id === location.id)) notFound();

  const [brief, staffing, sales, employees, comments] = await Promise.all([
    getBrief(db, eventId),
    staffs ? eventStaffing(db, eventId) : Promise.resolve(null),
    seesMoney ? getSalesSummaries([eventId]) : Promise.resolve(new Map()),
    staffs ? listEmployees(db) : Promise.resolve([]),
    staffs ? listComments(db, 'event_staffing', eventId, context.staff.id) : Promise.resolve([]),
  ]);
  const sale = sales.get(eventId) ?? null;

  return (
    <StaffShell context={context} unread={unread} wide={staffs}>
      <Back href="/staff/events" label="Events" />
      <Screen
        title={event.title}
        eyebrow={formatDayLong(event.startsAt, timezone)}
        lead={`${location.name} · ${event.doorsAt ? `doors ${formatClockShort(event.doorsAt, timezone)}` : `starts ${formatClockShort(event.startsAt, timezone)}`}`}
        actions={staffs ? <Button href={`/admin/events/one/${encodeURIComponent(eventId)}`} small>Event in admin</Button> : undefined}
      >
        <Section title="The brief">
          {brief || mine ? (
            <NightBrief
              title={event.title}
              startsAt={event.startsAt}
              doorsAt={event.doorsAt}
              timezone={timezone}
              crowd={brief?.expectedGuests ?? (sale ? sale.ticketsSold : null)}
              crowdLabel={brief?.expectedGuests != null ? 'expected' : 'tickets out'}
              brief={brief}
              myRole={mine?.positionName ?? null}
            />
          ) : (
            <Empty title="No brief yet." detail={staffs ? 'Fill it in below and everyone working that night sees it.' : 'A manager will post the details before the night.'} />
          )}
          {mine ? (
            <p className="mt-2 text-[0.875rem] text-brown-soft">
              You’re on {formatClockShort(mine.startsAt, timezone)} as {mine.positionName}.
            </p>
          ) : null}
        </Section>

        {staffs ? (
          <Section title="Write the brief">
            <BriefForm eventId={eventId} brief={brief} timezone={timezone} managers={employees.filter((employee) => employee.positionIds.includes('manager'))} />
          </Section>
        ) : null}

        {seesMoney && sale ? (
          <Section title="Tickets">
            <div className="staff-panel px-4 py-3.5">
              <Facts
                items={[
                  { label: 'Sold', value: String(sale.ticketsSold) },
                  { label: 'Checked in', value: String(sale.checkedIn) },
                  { label: 'Capacity', value: sale.capacity === null ? 'Not set' : String(sale.capacity) },
                  { label: 'Gross', value: formatPrice(sale.grossCents) },
                ]}
              />
              <p className="mt-2 text-[0.75rem] text-brown-soft">Managers only. This is not on the employee view of this night.</p>
            </div>
          </Section>
        ) : null}

        {staffs && staffing ? (
          <>
            <Section title="Staffing">
              <EventStaffingPanel staffing={staffing} employees={employees} timezone={timezone} canStaff />
            </Section>
            <Comments entityType="event_staffing" entityId={eventId} comments={comments} />
          </>
        ) : null}
      </Screen>
    </StaffShell>
  );
}
