import Link from 'next/link';
import { OneTap } from '@/components/staff/forms';
import { NightBrief } from '@/components/staff/NightBrief';
import { ShiftRow } from '@/components/staff/ShiftCard';
import { StaffShell } from '@/components/staff/StaffShell';
import { TodayList } from '@/components/staff/TodayList';
import { Button, Empty, Pill, Progress, Row, Section, Stat } from '@/components/staff/ui';
import { formatClockShort, formatDate, formatDayLong, formatShiftRange } from '@/lib/staff/time';
import { clockShift } from '@/server/actions/staff/schedule';
import { staffHome } from '@/server/staff/home';
import { contextCan } from '@/server/staff/session';
import { isDenied, staffPage } from './_lib';

export const dynamic = 'force-dynamic';


export default async function StaffHomePage() {
  const page = await staffPage('staff.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const home = await staffHome(db, context);
  const first = (context.employee?.preferredName || context.employee?.firstName || context.staff.name || '').split(/\s+/)[0] ?? '';
  const today = home.onNow ?? home.todayShifts[0] ?? null;
  const later = home.todayShifts.filter((shift) => shift !== today);
  const left = home.lines.filter((line) => !line.done).length;
  // Home holds a shift's worth of work, not a filing cabinet. Nine lines is
  // about a phone screen; the rest is a tap away on the checklist itself.
  const lines = home.lines.slice(0, 9);
  const more = home.lines.length - lines.length;
  const canClockIn = today !== null && !today.clockInAt && Date.now() >= Date.parse(today.startsAt) - 60 * 60_000 && Date.now() <= Date.parse(today.endsAt) + 60 * 60_000;
  const canClockOut = today !== null && Boolean(today.clockInAt) && !today.clockOutAt;

  return (
    <StaffShell context={context} unread={unread}>
      <div className="grid gap-7">
        <header>
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-brown-soft">Today at Cosa Nostra</p>
          <h1 className="display mt-1 text-[clamp(1.75rem,6vw,2.5rem)] leading-none text-brown">
            {home.greeting}
            {first ? `, ${first}` : ''}.
          </h1>
        </header>

        {home.onboarding && home.onboarding.stage !== 'ready' ? (
          <Link href="/staff/onboarding" className="staff-panel block border-amber/40 px-4 py-3.5">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-amber">Before your first shift</p>
            <div className="mt-2">
              <Progress value={home.onboarding.complete} max={home.onboarding.total} />
            </div>
            <p className="mt-2 text-[0.875rem] text-brown-soft">Tap to finish it.</p>
          </Link>
        ) : null}

        {/* ------------------------------------------------ am I working */}
        {context.employee ? (
          today ? (
            <section className="staff-panel border-amber/40 px-5 py-5">
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-amber">{home.onNow ? 'On now' : 'You’re working tonight'}</p>
              <p className="staff-figure mt-1.5 text-[clamp(2rem,9vw,2.75rem)] text-brown">{formatShiftRange(today.startsAt, today.endsAt, today.locationTimezone, { closeAfterMinutes: 4 * 60 })}</p>
              <p className="mt-2 text-[1.125rem] font-semibold text-brown">{today.positionName}</p>
              <p className="text-[0.9375rem] text-brown-soft">{today.locationName}</p>
              {today.event ? <p className="mt-2 text-[0.9375rem] text-brown">{today.event.title}</p> : null}
              {today.note ? <p className="mt-3 rounded-(--radius-sm) bg-brown/8 px-3 py-2 text-[0.875rem] leading-relaxed text-brown">{today.note}</p> : null}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {canClockIn ? <OneTap action={clockShift} fields={{ id: today.id, direction: 'in' }}>Clock in</OneTap> : null}
                {canClockOut ? <OneTap action={clockShift} fields={{ id: today.id, direction: 'out' }} variant="secondary">Clock out</OneTap> : null}
                {today.clockInAt && !today.clockOutAt ? <Pill tone="good">Clocked in</Pill> : null}
                <Button href={`/staff/schedule/shift/${today.id}`} variant="quiet" small>
                  Shift details
                </Button>
              </div>
              {later.map((shift) => (
                <p key={shift.id} className="mt-3 border-t border-brown/12 pt-3 text-[0.875rem] text-brown-soft">
                  Then {formatShiftRange(shift.startsAt, shift.endsAt, shift.locationTimezone)} · {shift.positionName}
                </p>
              ))}
            </section>
          ) : (
            <section className="staff-panel px-5 py-5">
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-brown-soft">Today</p>
              <p className="mt-1 text-[1.375rem] font-semibold text-brown">You’re off today.</p>
              {home.nextShift ? (
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-brown-soft">
                  Next shift: {formatDayLong(home.nextShift.startsAt, home.nextShift.locationTimezone)} at {formatClockShort(home.nextShift.startsAt, home.nextShift.locationTimezone)} · {home.nextShift.positionName}
                </p>
              ) : home.nextWeek.status === 'draft' && !context.isManager ? (
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-brown-soft">Next week’s schedule is being prepared. We’ll let you know when it’s live.</p>
              ) : (
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-brown-soft">Nothing on your schedule yet. Enjoy the quiet.</p>
              )}
            </section>
          )
        ) : (
          <section className="staff-panel px-5 py-5">
            <p className="text-[1.125rem] font-semibold text-brown">You’re signed in as a manager.</p>
            <p className="mt-1 text-[0.9375rem] text-brown-soft">No shift of your own — everything below is the house.</p>
          </section>
        )}

        {/* ---------------------------------------------- what is on tonight */}
        {home.tonight.length > 0 ? (
          <Section title={home.tonight.length === 1 ? 'Tonight' : 'Tonight at Cosa Nostra'}>
            <div className="grid gap-2">
              {home.tonight.map((event) => (
                <NightBrief
                  key={event.id}
                  title={event.title}
                  href={contextCan(context, 'events.view_brief') ? `/staff/events/${encodeURIComponent(event.id)}` : undefined}
                  startsAt={event.startsAt}
                  doorsAt={event.doorsAt}
                  timezone={home.timezone}
                  crowd={event.crowd}
                  crowdLabel={event.crowdLabel}
                  brief={event.brief}
                  myRole={event.myRole}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {/* --------------------------------------------------- what needs me */}
        {home.lines.length > 0 ? (
          <Section
            title="Your checklist"
            action={
              <span className="flex items-center gap-3 text-[0.8125rem] font-semibold text-brown-soft">
                {left === 0 ? 'All done' : `${left} left`}
                <Link href="/staff/tasks" className="underline underline-offset-4">
                  Your list
                </Link>
              </span>
            }
          >
            <TodayList lines={lines} />
            {home.checklists.length > 0 ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-brown-soft">
                {more > 0 ? <span>{more} more, on:</span> : null}
                {home.checklists.map((run) => (
                  <Link key={run.id} href={`/staff/checklists/${run.id}`} className="font-semibold text-brown underline underline-offset-4">
                    {run.title} ({run.done}/{run.total})
                  </Link>
                ))}
              </p>
            ) : null}
          </Section>
        ) : context.employee ? (
          <Section title="Your checklist">
            <Empty title="You’re all set." detail="Nothing on your list right now." action={<Button href="/staff/tasks" variant="quiet">See everything assigned to you</Button>} />
          </Section>
        ) : null}

        {/* ------------------------------------------------------ important */}
        {home.announcements.length > 0 ? (
          <Section title="Important" action={<Link href="/staff/announcements" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">All</Link>}>
            <div className="grid gap-2">
              {home.announcements.map((entry) => (
                <Link key={entry.id} href="/staff/announcements" className={`staff-panel block px-4 py-3.5 active:bg-brown/6 ${entry.kind === 'urgent' ? 'border-warning/50' : ''}`}>
                  <p className="flex flex-wrap items-center gap-2 text-[1rem] font-semibold text-brown">
                    {entry.kind === 'urgent' ? <Pill tone="warn">Urgent</Pill> : null}
                    {entry.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[0.875rem] leading-relaxed text-brown-soft">{entry.body}</p>
                  <p className="mt-1.5 text-[0.75rem] text-brown-soft/80">
                    {entry.authorName ? `Posted by ${entry.authorName}` : 'Posted'}
                    {entry.requiresAck && !entry.acknowledgedAt ? ' · needs your acknowledgement' : ''}
                  </p>
                </Link>
              ))}
            </div>
          </Section>
        ) : null}

        {/* ------------------------------------------------- who else is on */}
        {home.withYou.length > 0 && today ? (
          <Section title="On with you tonight">
            <div className="staff-panel flex flex-wrap gap-x-5 gap-y-1.5 px-4 py-3">
              {home.withYou.map((mate) => (
                <p key={`${mate.name}-${mate.startsAt}`} className="text-[0.875rem] text-brown">
                  {mate.name}
                  <span className="text-brown-soft"> · {mate.position} · {formatClockShort(mate.startsAt, home.timezone)}</span>
                </p>
              ))}
            </div>
          </Section>
        ) : null}

        {/* --------------------------------------------------- what is next */}
        {context.employee && today && home.nextShift && home.nextShift !== today ? (
          <Section title="Next shift" action={<Link href="/staff/schedule" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">Schedule</Link>}>
            <div className="staff-panel px-4">
              <ShiftRow shift={home.nextShift} href={`/staff/schedule/shift/${home.nextShift.id}`} />
            </div>
          </Section>
        ) : null}

        {/* The reassurance is for the person waiting on the schedule. A manager
            is the one preparing it, and is told so in The house instead. */}
        {context.employee && !context.isManager && home.nextWeek.status === 'draft' ? (
          <p className="text-[0.875rem] leading-relaxed text-brown-soft">
            <span className="font-semibold text-brown">Next week’s schedule is being prepared.</span> We’ll let you know when it’s live.
          </p>
        ) : null}

        {/* ------------------------------------------------------- training */}
        {context.employee && home.training.length > 0 ? (
          <Section title="Training due" action={<Link href="/staff/training" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">All</Link>}>
            <div className="staff-panel px-4">
              {home.training.map((assignment) => (
                <Row
                  key={assignment.id}
                  href={`/staff/training/${assignment.moduleId}`}
                  title={assignment.module.title}
                  detail={assignment.dueOn ? `Due ${formatDate(assignment.dueOn, 'short')}` : assignment.module.estimatedMinutes ? `About ${assignment.module.estimatedMinutes} min` : undefined}
                  trailing={assignment.overdue ? <Pill tone="bad">Overdue</Pill> : assignment.outdated ? <Pill tone="warn">Updated</Pill> : assignment.module.required ? <Pill tone="accent">Required</Pill> : null}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {/* ---------------------------------------------------- up for grabs */}
        {home.openShifts.length > 0 || home.coverage.length > 0 ? (
          <Section title="Up for grabs" action={<Link href="/staff/schedule/coverage" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">See all</Link>}>
            <div className="staff-panel px-4">
              {home.coverage.map((request) => (
                <ShiftRow key={request.id} shift={{ ...request.shift, employeeName: request.requestedByName }} href="/staff/schedule/coverage" showEmployee />
              ))}
              {home.openShifts.map((shift) => (
                <ShiftRow key={shift.id} shift={shift} href="/staff/schedule/coverage" />
              ))}
            </div>
          </Section>
        ) : null}

        {/* ------------------------------------------------------ the house */}
        {home.managerToday ? (
          <Section title="The house" action={<Link href="/staff/operations" className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">Operations</Link>}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat value={home.managerToday.scheduled} label="on tonight" href="/staff/schedule" />
              <Stat value={home.managerToday.openShifts} label="open shifts" href="/staff/schedule" tone={home.managerToday.openShifts ? 'warn' : undefined} />
              <Stat value={home.managerToday.unpublished} label="unpublished next week" href={`/staff/schedule?week=${home.nextWeek.weekStart}`} tone={home.managerToday.unpublished ? 'warn' : undefined} />
              <Stat value={home.managerToday.needsDecision} label="waiting on you" href="/staff/schedule/coverage" tone={home.managerToday.needsDecision ? 'warn' : undefined} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button href="/staff/schedule" variant="primary">
                {home.nextWeek.status === 'draft' ? 'Build next week' : 'Schedule'}
              </Button>
              <Button href="/staff/operations">Operations</Button>
            </div>
          </Section>
        ) : null}
      </div>
    </StaffShell>
  );
}
