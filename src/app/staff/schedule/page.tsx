import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Drawer } from '@/components/staff/Drawer';
import { OneTap } from '@/components/staff/forms';
import { ShiftForm } from '@/components/staff/manage/ShiftForm';
import { ScheduleBoard } from '@/components/staff/ScheduleBoard';
import { StaffShell } from '@/components/staff/StaffShell';
import { Button, Chips, Empty, Pill, Screen, Section } from '@/components/staff/ui';
import { addDays, formatClockShort, formatDate, formatDayLong, formatShiftRange, startOfWeek, weekOf, zonedDate, zonedInstant } from '@/lib/staff/time';
import { copySchedule, publishSchedule } from '@/server/actions/staff/schedule';
import { listEmployees, listPositions } from '@/server/staff/employees';
import { getPeriod, weekBounds } from '@/server/staff/periods';
import { getShiftView, listShiftViews } from '@/server/staff/schedule';
import { listTimeOff } from '@/server/staff/timeoff';
import { contextCan, type StaffContext } from '@/server/staff/session';
import type { Db } from '@/lib/db/types';
import type { LocationSummary } from '@/content/staff-types';
import { eventOptionsFor, isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

/**
 * Schedule. One route, two jobs, decided by what the account may do.
 *
 * An employee gets their own week and nothing else — no board, no drafts, no
 * other people's hours. A manager gets the board they build the week on, with
 * their own shifts one chip away. Splitting these across two URLs is how the
 * old app ended up with "Schedule" and "Build schedule" in a menu, which asks
 * the user to know something about the software.
 */
interface Params {
  week?: string;
  location?: string;
  position?: string;
  show?: string;
  view?: string;
  edit?: string;
  add?: string;
  who?: string;
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Params> }) {
  const page = await staffPage('schedule.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const params = await searchParams;
  const manages = contextCan(context, 'schedule.manage');
  const location = context.locations.find((entry) => entry.slug === params.location || entry.id === params.location) ?? context.location;
  const timezone = location.timezone;
  const today = zonedDate(new Date(), timezone);
  const anchor = params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : today;
  const days = weekOf(anchor);
  const weekStart = days[0]!;
  const label = `${formatDate(weekStart, 'short')} – ${formatDate(days[6]!, 'short')}`;

  return manages
    ? buildWeek({ context, db, unread, params, location, timezone, today, days, weekStart, label })
    : myWeek({ context, db, unread, params, timezone, today, days, weekStart, label });
}

/* ------------------------------------------------------------ the manager */

async function buildWeek({
  context,
  db,
  unread,
  params,
  location,
  timezone,
  today,
  days,
  weekStart,
  label,
}: {
  context: StaffContext;
  db: Db;
  unread: number;
  params: Params;
  location: LocationSummary;
  timezone: string;
  today: string;
  days: string[];
  weekStart: string;
  label: string;
}) {
  const { from, to } = weekBounds(weekStart, timezone);
  const mineOnly = params.show === 'mine';
  const [all, employees, positions, timeOff, period] = await Promise.all([
    listShiftViews(db, { from, to, locationId: location.id, includeDrafts: true, includeCancelled: false }, { withWarnings: true }),
    listEmployees(db, { locationId: location.id }),
    listPositions(db),
    listTimeOff(db, { status: 'approved', from: weekStart }),
    getPeriod(db, location.id, weekStart),
  ]);

  const position = params.position && positions.some((entry) => entry.id === params.position) ? params.position : null;
  const shifts = all
    .filter((shift) => !position || shift.positionId === position)
    .filter((shift) => (params.show === 'open' ? !shift.employeeId : true))
    .filter((shift) => (params.show === 'issues' ? shift.warnings.length > 0 : true))
    .filter((shift) => (mineOnly ? shift.employeeId === context.employee?.id : true));

  const drafts = all.filter((shift) => shift.status === 'draft').length;
  const open = all.filter((shift) => !shift.employeeId).length;
  const issues = all.filter((shift) => shift.warnings.length > 0).length;
  const people = new Set(all.filter((shift) => shift.employeeId).map((shift) => shift.employeeId)).size;
  const live = period?.status === 'published';

  const query = (extra: Record<string, string | null> = {}) => {
    const next = new URLSearchParams();
    next.set('week', weekStart);
    if (location.slug) next.set('location', location.slug);
    if (position) next.set('position', position);
    if (params.show) next.set('show', params.show);
    for (const [key, value] of Object.entries(extra)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    return `/staff/schedule?${next.toString()}`;
  };
  const closeHref = query({ edit: null, add: null, who: null });

  const drawer = await scheduleDrawer({ context, db, params, location, timezone, weekStart, closeHref });

  return (
    <StaffShell context={context} unread={unread} wide>
      <Screen
        title="Schedule"
        eyebrow={location.name}
        lead={label}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Button href={query({ week: addDays(weekStart, -7) })} small>
              ←
            </Button>
            <Button href={query({ week: startOfWeek(today) })} small>
              This week
            </Button>
            <Button href={query({ week: addDays(weekStart, 7) })} small>
              →
            </Button>
            <Button href={query({ add: weekStart })} variant="primary" small>
              + Shift
            </Button>
          </div>
        }
      >
        {/* ------------------------------------------------- draft or live */}
        <div className={`staff-panel flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5 ${live ? '' : 'border-amber/40'}`}>
          <div className="flex items-center gap-2.5">
            {live ? <Pill tone="good">Live</Pill> : <Pill tone="accent">Draft</Pill>}
            <p className="text-[0.9375rem] text-brown">
              {live ? (
                <>
                  Published{period?.publishedAt ? ` ${formatDate(period.publishedAt.slice(0, 10), 'short')}` : ''}.
                  {drafts > 0 ? <span className="text-warning"> {drafts} unpublished {drafts === 1 ? 'change' : 'changes'}.</span> : ''}
                </>
              ) : all.length === 0 ? (
                <>Nothing built yet. Staff see “being prepared”.</>
              ) : (
                <>Staff can’t see this week yet.</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.875rem] text-brown-soft">
            <span>
              <strong className="text-brown">{all.length}</strong> shifts
            </span>
            <span>
              <strong className="text-brown">{people}</strong> {people === 1 ? 'person' : 'people'}
            </span>
            {open > 0 ? (
              <Link href={query({ show: 'open' })} className="text-warning underline underline-offset-4">
                {open} open
              </Link>
            ) : null}
            {issues > 0 ? (
              <Link href={query({ show: 'issues' })} className="text-warning underline underline-offset-4">
                {issues} to check
              </Link>
            ) : null}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {drafts > 0 || !live ? (
              <OneTap
                action={publishSchedule}
                fields={{ weekStart, locationId: location.id }}
                confirm={
                  live
                    ? `Publish ${drafts} new ${drafts === 1 ? 'shift' : 'shifts'} for ${label}? Only the people affected are told.`
                    : all.length === 0
                      ? `Nobody is on ${label}. Publishing tells staff the week is out and they are off — rather than leaving it as "being prepared".`
                      : `Publish ${label} to ${people} ${people === 1 ? 'staff member' : 'staff members'}? Everyone scheduled gets a notification.`
                }
              >
                {live ? 'Publish changes' : all.length === 0 ? 'Publish empty week' : 'Publish schedule'}
              </OneTap>
            ) : null}
            <OneTap action={copySchedule} fields={{ weekStart, locationId: location.id }} variant="secondary" confirm={`Copy this week's ${all.length} shifts into ${formatDate(addDays(weekStart, 7), 'short')} as drafts?`}>
              Copy to next week
            </OneTap>
          </div>
        </div>

        {/* ----------------------------------------------------- narrowing */}
        <Chips
          items={[
            { href: query({ show: null }), label: 'Everyone', active: !params.show },
            { href: query({ show: 'open' }), label: 'Open', active: params.show === 'open', count: open || undefined },
            { href: query({ show: 'issues' }), label: 'Needs a look', active: params.show === 'issues', count: issues || undefined },
            ...(context.employee ? [{ href: query({ show: 'mine' }), label: 'Mine', active: params.show === 'mine' }] : []),
            ...context.locations.filter((entry) => entry.id !== location.id).map((entry) => ({ href: `/staff/schedule?week=${weekStart}&location=${entry.slug}`, label: entry.shortName, active: false })),
          ]}
        />
        <Chips
          items={[
            { href: query({ position: null }), label: 'All positions', active: !position },
            ...positions
              .filter((entry) => entry.active)
              .map((entry) => ({ href: query({ position: entry.id }), label: entry.name, active: position === entry.id })),
          ]}
        />

        {all.length === 0 ? (
          <Empty
            title="Nothing on this week yet."
            detail="Add a shift, or copy the week before it forward and adjust."
            action={<Button href={query({ week: addDays(weekStart, -7) })}>Go to last week</Button>}
          />
        ) : shifts.length === 0 ? (
          <Empty title="Nothing matches that filter." detail="Clear it to see the week." action={<Button href={query({ show: null, position: null })}>Show everyone</Button>} />
        ) : (
          <ScheduleBoard
            days={days}
            today={today}
            timezone={timezone}
            shifts={shifts}
            employees={mineOnly ? employees.filter((employee) => employee.id === context.employee?.id) : employees}
            timeOff={timeOff}
            links={{
              shift: (id) => query({ edit: id }),
              add: (date, employeeId) => query({ add: date, who: employeeId ?? 'open' }),
            }}
          />
        )}

        <p className="text-[0.8125rem] text-brown-soft">
          Drafts are a working copy — nobody sees them until the week is published. After that, a change tells only the person it moves.{' '}
          <Link href="/staff/schedule/coverage" className="font-semibold text-brown underline underline-offset-4">
            Shift requests
          </Link>{' '}
          ·{' '}
          <Link href="/staff/operations/time-off" className="font-semibold text-brown underline underline-offset-4">
            Time off
          </Link>
        </p>
      </Screen>
      {drawer}
    </StaffShell>
  );
}

/** The editor over the board, when the URL asks for one. */
async function scheduleDrawer({
  context,
  db,
  params,
  location,
  timezone,
  weekStart,
  closeHref,
}: {
  context: StaffContext;
  db: Db;
  params: Params;
  location: LocationSummary;
  timezone: string;
  weekStart: string;
  closeHref: string;
}) {
  if (!params.edit && !params.add) return null;
  const [employees, positions, events] = await Promise.all([listEmployees(db), listPositions(db), eventOptionsFor(db, timezone)]);
  const active = positions.filter((position) => position.active);

  if (params.edit) {
    const shift = await getShiftView(db, params.edit, { withWarnings: true });
    if (!shift) notFound();
    return (
      <Drawer
        title={shift.employeeName ?? 'Open shift'}
        eyebrow={`${formatDayLong(shift.startsAt, shift.locationTimezone)} · ${shift.status === 'draft' ? 'Draft' : shift.status === 'cancelled' ? 'Cancelled' : 'Published'}`}
        closeHref={closeHref}
      >
        {shift.warnings.length > 0 ? (
          <div className="mb-4 grid gap-2">
            {shift.warnings.map((warning) => (
              <p key={warning.kind} className="rounded-(--radius-sm) border border-warning/50 bg-warning/8 px-3 py-2 text-[0.875rem] leading-snug text-warning">
                {warning.message}
              </p>
            ))}
          </div>
        ) : null}
        <ShiftForm
          shift={shift}
          date={zonedDate(shift.startsAt, shift.locationTimezone)}
          employees={employees}
          positions={active}
          locations={context.locations}
          events={events}
          defaultLocationId={shift.locationId}
          closeHref={closeHref}
        />
        <p className="mt-5 border-t border-brown/12 pt-4 text-[0.8125rem] text-brown-soft">
          <Link href={`/staff/schedule/shift/${shift.id}`} className="font-semibold text-brown underline underline-offset-4">
            Open the full shift
          </Link>{' '}
          for attendance, history and notes.
        </p>
      </Drawer>
    );
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.add ?? '') ? params.add! : weekStart;
  const who = params.who && params.who !== 'open' ? params.who : null;
  return (
    <Drawer title="New shift" eyebrow={formatDate(date)} closeHref={closeHref}>
      <ShiftForm
        shift={null}
        date={date}
        employees={employees}
        positions={active}
        locations={context.locations}
        events={events}
        defaultLocationId={location.id}
        defaultEmployeeId={who}
        closeHref={closeHref}
      />
    </Drawer>
  );
}

/* ----------------------------------------------------------- the employee */

async function myWeek({
  context,
  db,
  unread,
  params,
  timezone,
  today,
  days,
  weekStart,
  label,
}: {
  context: StaffContext;
  db: Db;
  unread: number;
  params: Params;
  timezone: string;
  today: string;
  days: string[];
  weekStart: string;
  label: string;
}) {
  const employee = context.employee;
  const { from, to } = weekBounds(weekStart, timezone);
  const [shifts, timeOff, period] = employee
    ? await Promise.all([
        listShiftViews(db, { from, to, employeeId: employee.id }),
        listTimeOff(db, { employeeId: employee.id, status: 'approved', from: weekStart }),
        getPeriod(db, context.location.id, weekStart),
      ])
    : [[], [], null];
  const live = period?.status === 'published';
  const future = weekStart > startOfWeek(today);
  const href = (week: string) => `/staff/schedule?week=${week}`;

  return (
    <StaffShell context={context} unread={unread}>
      <Screen
        title="Schedule"
        lead={label}
        actions={
          <div className="flex items-center gap-1.5">
            <Button href={href(addDays(weekStart, -7))} small>
              ←
            </Button>
            <Button href={href(startOfWeek(today))} small>
              This week
            </Button>
            <Button href={href(addDays(weekStart, 7))} small>
              →
            </Button>
          </div>
        }
      >
        <Chips
          items={[
            { href: '/staff/schedule', label: 'My shifts', active: true },
            { href: '/staff/schedule/coverage', label: 'Up for grabs', active: false },
            { href: '/staff/time-off', label: 'Time off', active: false },
            { href: '/staff/availability', label: 'Availability', active: false },
          ]}
        />

        {!employee ? <Empty title="No schedule of your own." detail="You have a manager sign-in without an employee record." /> : null}

        {employee && future && !live ? (
          <div className="staff-panel border-amber/40 px-5 py-4">
            <p className="text-[1.0625rem] font-semibold text-brown">
              {weekStart === addDays(startOfWeek(today), 7) ? 'Next week’s schedule is being prepared.' : `The week of ${formatDate(weekStart, 'short')} is being prepared.`}
            </p>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-brown-soft">We’ll let you know the moment it’s live — you’ll get a notification.</p>
          </div>
        ) : null}

        {employee && (live || !future) ? (
          <Section title={weekStart === startOfWeek(today) ? 'This week' : label} action={live ? <span className="text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-success">Schedule is live</span> : undefined}>
            <div className="staff-panel px-4">
              {days.map((day) => {
                const mine = shifts.filter((shift) => zonedDate(shift.startsAt, timezone) === day).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
                const off = timeOff.some((request) => day >= request.startsOn && day <= request.endsOn);
                return (
                  <div key={day} className={`staff-row items-start gap-4 ${day === today ? 'bg-amber/6 -mx-4 px-4' : ''}`}>
                    <span className="w-14 shrink-0">
                      <span className={`block text-[0.9375rem] font-semibold ${day === today ? 'text-amber' : 'text-brown'}`}>{formatDate(day, 'short').split(',')[0]}</span>
                      <span className="tabular block text-[0.75rem] text-brown-soft">{Number(day.slice(8, 10))}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      {mine.length === 0 ? (
                        <span className="block py-1 text-[0.9375rem] text-brown-soft">{off ? 'Time off' : 'Off'}</span>
                      ) : (
                        mine.map((shift) => (
                          <Link key={shift.id} href={`/staff/schedule/shift/${shift.id}`} className="block py-1">
                            <span className="tabular block text-[1rem] font-semibold text-brown">{formatShiftRange(shift.startsAt, shift.endsAt, timezone, { closeAfterMinutes: 4 * 60 })}</span>
                            <span className="block text-[0.875rem] text-brown-soft">
                              {shift.positionName}
                              {shift.event ? ` · ${shift.event.title}` : ''}
                              {shift.locationName !== context.location.shortName ? ` · ${shift.locationName}` : ''}
                            </span>
                          </Link>
                        ))
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        ) : null}

        {employee && shifts.length === 0 && (live || !future) ? (
          <Empty title="You’re off this week." detail="Nothing scheduled. Enjoy it." />
        ) : null}

        {employee && shifts.length > 0 ? (
          <p className="text-[0.8125rem] text-brown-soft">
            Can’t make one?{' '}
            <Link href="/staff/schedule/coverage" className="font-semibold text-brown underline underline-offset-4">
              Offer it up
            </Link>{' '}
            or{' '}
            <Link href="/staff/time-off" className="font-semibold text-brown underline underline-offset-4">
              request time off
            </Link>
            .
          </p>
        ) : null}

        {employee ? (
          <NextUp db={db} employeeId={employee.id} timezone={timezone} today={today} weekStart={weekStart} params={params} />
        ) : null}
      </Screen>
    </StaffShell>
  );
}

/** What is after this week, so the screen does not end on an empty Sunday. */
async function NextUp({
  db,
  employeeId,
  timezone,
  today,
  weekStart,
  params,
}: {
  db: Db;
  employeeId: string;
  timezone: string;
  today: string;
  weekStart: string;
  params: Params;
}) {
  if (params.week && weekStart !== startOfWeek(today)) return null;
  const after = await listShiftViews(db, {
    from: zonedInstant(addDays(weekStart, 7), 0, timezone),
    to: zonedInstant(addDays(weekStart, 28), 0, timezone),
    employeeId,
  });
  if (after.length === 0) return null;
  return (
    <Section title="After this week">
      <div className="staff-panel px-4">
        {after.slice(0, 6).map((shift) => (
          <Link key={shift.id} href={`/staff/schedule/shift/${shift.id}`} className="staff-row -mx-1 px-1 active:bg-brown/6">
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold text-brown">{formatDayLong(shift.startsAt, timezone)}</span>
              <span className="tabular mt-0.5 block text-[0.8125rem] text-brown-soft">
                {formatClockShort(shift.startsAt, timezone)} · {shift.positionName}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );
}
