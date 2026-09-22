import Link from 'next/link';
import { OneTap } from '@/components/staff/forms';
import { NightBrief } from '@/components/staff/NightBrief';
import { RolePreview } from '@/components/staff/RolePreview';
import { ShiftRow } from '@/components/staff/ShiftCard';
import { StaffShell } from '@/components/staff/StaffShell';
import { Button, Chips, Empty, Pill, Row, Screen, Section, Stat } from '@/components/staff/ui';
import { STAFFING_ROLE_LABEL } from '@/content/staff-types';
import { formatDate, formatDateRange, formatDayShort, formatRelative, formatShiftRange } from '@/lib/staff/time';
import { decideCoverage } from '@/server/actions/staff/coverage';
import { decideTimeOffRequest } from '@/server/actions/staff/timeoff';
import { briefsFor } from '@/server/staff/briefs';
import { managerDashboard } from '@/server/staff/dashboard';
import { contextCan } from '@/server/staff/session';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

/**
 * Operations: tonight, then everything else.
 *
 * This replaced a "Manage" dropdown with ten entries in it. A menu can only
 * list; a screen can say how many documents are expiring and which two
 * people are waiting on a decision, which is the difference between a
 * manager hunting and a manager working. The top half is the night; the
 * bottom half is the index — and the index is the only place the deeper
 * modules are advertised, so the nav bar stays five items wide.
 */
export default async function OperationsPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const page = await staffPage('schedule.view_team');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { location: locationParam } = await searchParams;
  const all = context.isOwner && locationParam === 'all';
  const chosen = locationParam && locationParam !== 'all' ? context.locations.find((entry) => entry.id === locationParam || entry.slug === locationParam) : null;
  const locations = all ? context.locations : [chosen ?? context.location];
  const dashboard = await managerDashboard(db, locations);
  const multi = context.locations.length > 1;
  const briefs = await briefsFor(db, dashboard.days.flatMap((day) => day.events.map((event) => event.id)));
  const decisions = dashboard.pendingTimeOff.length + dashboard.coverage.filter((request) => request.claimedBy || request.kind === 'give_up').length;
  const documents = dashboard.documentsExpired.length + dashboard.documentsExpiring.length + dashboard.documentsSubmitted.length;

  return (
    <StaffShell context={context} unread={unread} wide>
      <Screen
        title="Operations"
        eyebrow={all ? 'Every location' : locations[0]!.name}
        lead={formatDate(dashboard.today)}
        actions={<Button href="/staff/schedule" variant="primary">Schedule</Button>}
      >
        {multi ? (
          <Chips
            items={[
              ...context.locations.map((location) => ({ href: `/staff/operations?location=${location.slug}`, label: location.shortName, active: !all && locations[0]!.id === location.id })),
              ...(context.isOwner ? [{ href: '/staff/operations?location=all', label: 'All', active: all }] : []),
            ]}
          />
        ) : null}

        {dashboard.days.map((day) => (
          <div key={day.location.id} className="grid gap-5">
            {all ? <h2 className="display text-[1.5rem] leading-none text-brown">{day.location.name}</h2> : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Stat value={day.scheduled.length} label="on tonight" href={`/staff/schedule?location=${day.location.slug}`} />
              <Stat value={day.openShifts.length} label="open shifts" href="/staff/schedule/coverage" tone={day.openShifts.length ? 'warn' : undefined} />
              <Stat value={decisions} label="waiting on you" href="/staff/schedule/coverage" tone={decisions ? 'warn' : undefined} />
              <Stat value={day.overdueTasks.length} label="overdue tasks" href="/staff/operations/tasks" tone={day.overdueTasks.length ? 'warn' : undefined} />
              <Stat value={day.draftCount} label="unpublished shifts" href={`/staff/schedule?location=${day.location.slug}`} tone={day.draftCount ? 'warn' : undefined} />
            </div>

            {day.events.length > 0 ? (
              <Section title="Tonight">
                <div className="grid gap-2">
                  {day.events.map((event) => (
                    <div key={event.id}>
                      <NightBrief
                        title={event.title}
                        href={`/staff/events/${encodeURIComponent(event.id)}`}
                        startsAt={event.startsAt}
                        doorsAt={event.doorsAt}
                        timezone={day.location.timezone}
                        crowd={briefs.get(event.id)?.expectedGuests ?? event.ticketsSold}
                        crowdLabel={briefs.get(event.id)?.expectedGuests != null ? 'expected' : 'tickets out'}
                        brief={briefs.get(event.id) ?? null}
                        myRole={null}
                      />
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[0.8125rem]">
                        {event.staffing.map((entry, index) => (
                          <span key={index} className="text-brown-soft">
                            <span className="text-success">✓</span> {STAFFING_ROLE_LABEL[entry.role]}: {entry.name}
                          </span>
                        ))}
                        {event.gaps.map((role) => (
                          <Link key={role} href={`/staff/events/${encodeURIComponent(event.id)}`} className="font-semibold text-warning underline underline-offset-4">
                            {STAFFING_ROLE_LABEL[role]} unassigned
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {day.scheduleIssues.length > 0 ? (
              <Section title="Worth a look" count={day.scheduleIssues.length}>
                <div className="staff-panel px-4">
                  {day.scheduleIssues.map((shift) => (
                    <ShiftRow key={shift.id} shift={shift} href={`/staff/schedule?edit=${shift.id}`} showEmployee showDate={false} />
                  ))}
                </div>
              </Section>
            ) : null}

            {day.checklists.length > 0 ? (
              <Section title="Checklists today" action={<Link href="/staff/operations/checklists" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">All</Link>}>
                <div className="staff-panel px-4">
                  {day.checklists.map((run) => (
                    <Row key={run.id} href={`/staff/checklists/${run.id}`} title={run.title} detail={`${run.done} of ${run.total}${run.assignedEmployeeName ? ` · ${run.assignedEmployeeName}` : ''}`} trailing={run.status === 'verified' ? <Pill tone="good">Verified</Pill> : run.status === 'complete' ? <Pill tone="accent">Verify</Pill> : null} />
                  ))}
                </div>
              </Section>
            ) : null}
          </div>
        ))}

        {/* ------------------------------------------------ decisions to make */}
        {dashboard.pendingTimeOff.length > 0 ? (
          <Section title="Time off" count={dashboard.pendingTimeOff.length} action={<Link href="/staff/operations/time-off" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">All</Link>}>
            <div className="staff-panel px-4">
              {dashboard.pendingTimeOff.slice(0, 4).map((request) => (
                <div key={request.id} className="staff-row flex-wrap gap-y-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold text-brown">
                      {request.employeeName} · {formatDateRange(request.startsOn, request.endsOn)}
                    </span>
                    <span className="block text-[0.8125rem] text-brown-soft">
                      {request.reason ?? 'No reason given'} · asked {formatRelative(request.createdAt)}
                    </span>
                  </span>
                  {request.employeeId !== context.employee?.id ? (
                    <span className="flex gap-2">
                      <OneTap action={decideTimeOffRequest} fields={{ id: request.id, decision: 'approved' }} variant="secondary">
                        Approve
                      </OneTap>
                      <OneTap action={decideTimeOffRequest} fields={{ id: request.id, decision: 'denied' }} variant="quiet">
                        Deny
                      </OneTap>
                    </span>
                  ) : (
                    <span className="text-[0.8125rem] text-brown-soft">Yours — another manager decides</span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {dashboard.coverage.length > 0 ? (
          <Section title="Shift requests" count={dashboard.coverage.length} action={<Link href="/staff/schedule/coverage" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">All</Link>}>
            <div className="staff-panel px-4">
              {dashboard.coverage.slice(0, 4).map((request) => (
                <div key={request.id} className="staff-row flex-wrap gap-y-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold text-brown">
                      {request.requestedByName} · {formatDayShort(request.shift.startsAt, request.shift.locationTimezone)} {formatShiftRange(request.shift.startsAt, request.shift.endsAt, request.shift.locationTimezone)}
                    </span>
                    <span className="block text-[0.8125rem] text-brown-soft">
                      {request.shift.positionName} · {request.claimedByName ? `${request.claimedByName} wants it` : 'nobody has claimed it yet'}
                    </span>
                  </span>
                  {request.claimedBy || request.kind === 'give_up' ? (
                    <span className="flex gap-2">
                      <OneTap action={decideCoverage} fields={{ id: request.id, decision: 'approved' }} variant="secondary">
                        Approve
                      </OneTap>
                      <OneTap action={decideCoverage} fields={{ id: request.id, decision: 'denied' }} variant="quiet">
                        Deny
                      </OneTap>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {/* ------------------------------------------------------- the index */}
        <Section title="Everything else">
          <div className="grid gap-2 lg:grid-cols-2">
            <div className="staff-panel px-4">
              <Row href="/staff/events" title="Events" detail="Staffing, briefs and who is on each night" icon="events" />
              <Row href="/staff/operations/checklists" title="Checklists" detail="Opening, closing, event setup" icon="check" />
              <Row href="/staff/operations/tasks" title="Tasks" detail="Assign and follow up" icon="tasks" trailing={dashboard.days[0]?.overdueTasks.length ? <Pill tone="warn">{dashboard.days[0].overdueTasks.length} overdue</Pill> : null} />
              <Row href="/staff/announcements/manage" title="Announcements" detail="Post, and see who has read it" icon="announcements" />
              <Row href="/staff/incidents" title="Incidents" detail="Reviewed by managers only" icon="incidents" />
            </div>
            <div className="staff-panel px-4">
              <Row href="/staff/operations/training" title="Training" detail="Modules, assignments, who is cleared" icon="training" trailing={dashboard.trainingOverdue.length ? <Pill tone="bad">{dashboard.trainingOverdue.length} overdue</Pill> : null} />
              <Row href="/staff/operations/documents" title="Documents" detail="Missing, expiring, waiting to be verified" icon="documents" trailing={documents ? <Pill tone="warn">{documents}</Pill> : null} />
              <Row href="/staff/operations/onboarding" title="Onboarding" detail="New hires and where they are up to" icon="profile" trailing={dashboard.onboarding.length ? <Pill tone="accent">{dashboard.onboarding.length}</Pill> : null} />
              <Row href="/staff/contractors" title="Contractors" detail="DJs, instructors, photographers and their bookings" icon="contractors" trailing={dashboard.contractorsUnpaid.length ? <Pill tone="warn">{dashboard.contractorsUnpaid.length} unpaid</Pill> : null} />
              <Row href="/staff/search" title="Search" detail="People, phone numbers, events" icon="search" />
              {contextCan(context, 'locations.manage') ? <Row href="/staff/locations" title="Locations" detail="Chicago, and the next one" icon="locations" /> : null}
              <Row href="/staff/profile" title="Your profile" detail="Your own details, availability and notifications" icon="profile" />
            </div>
          </div>
        </Section>

        {contextCan(context, 'system.preview_role') ? <RolePreview current={context.previewing} /> : null}

        {dashboard.days.every((day) => day.events.length === 0 && day.scheduled.length === 0) && decisions === 0 ? (
          <Empty title="A quiet day." detail="Nothing scheduled and no events. The week is one tap away." action={<Button href="/staff/schedule">Open the schedule</Button>} />
        ) : null}
      </Screen>
    </StaffShell>
  );
}
