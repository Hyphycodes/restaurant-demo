import { notFound } from 'next/navigation';
import { Comments } from '@/components/staff/Comments';
import { OneTap } from '@/components/staff/forms';
import { ShiftHero } from '@/components/staff/ShiftCard';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Facts, Pill, Screen, Section } from '@/components/staff/ui';
import { ATTENDANCE_LABEL } from '@/content/staff-types';
import { formatClock, formatDayLong, formatDayShort, formatRelative, formatShiftRange, zonedDate } from '@/lib/staff/time';
import { clockShift, confirmFirstShift } from '@/server/actions/staff/schedule';
import { withdrawOffer } from '@/server/actions/staff/coverage';
import { listComments } from '@/server/staff/comments';
import { listShiftRequests } from '@/server/staff/coverage';
import { getEmployee } from '@/server/staff/employees';
import { getShiftView, listShiftViews, shiftHistory } from '@/server/staff/schedule';
import { canSeeEmployee } from '@/server/staff/session';
import { isDenied, staffPage } from '../../../_lib';
import { OfferShift } from './OfferShift';

export const dynamic = 'force-dynamic';

export default async function ShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const page = await staffPage('schedule.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const shift = await getShiftView(db, id, { withWarnings: context.isManager });
  if (!shift) notFound();
  if (shift.employeeId && !canSeeEmployee(context, shift.employeeId)) notFound();
  if (!shift.employeeId && !context.isManager && shift.status !== 'published') notFound();
  const mine = context.employee?.id === shift.employeeId;
  const now = Date.now();
  const [requests, history, comments, mySwapOptions] = await Promise.all([
    listShiftRequests(db, { status: ['open', 'claimed'] }),
    context.isManager || mine ? shiftHistory(db, shift.id) : Promise.resolve([]),
    listComments(db, 'shift', shift.id, context.staff.id),
    mine ? listShiftViews(db, { from: new Date().toISOString(), to: new Date(now + 60 * 86_400_000).toISOString(), employeeId: shift.employeeId! }) : Promise.resolve([]),
  ]);
  const request = requests.find((entry) => entry.shift.id === shift.id);
  const canClockIn = mine && shift.status === 'published' && !shift.clockInAt && now >= Date.parse(shift.startsAt) - 60 * 60_000 && now <= Date.parse(shift.endsAt) + 60 * 60_000;
  const canClockOut = mine && shift.clockInAt && !shift.clockOutAt;
  const upcoming = Date.parse(shift.startsAt) > now;
  const firstShift = mine && context.employee && !context.employee.onboardingCompletedAt && upcoming;
  const firstShiftConfirmed = firstShift ? Boolean((await getEmployee(db, context.employee!.id))?.firstShiftConfirmedAt) : false;

  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/schedule" label="Schedule" />
      <Screen title={formatDayLong(shift.startsAt, shift.locationTimezone)}>
        <ShiftHero shift={shift} label={shift.employeeName ? (mine ? 'Your shift' : shift.employeeName) : 'Open shift'} />
        {shift.warnings.length > 0 ? (
          <div className="grid gap-2">
            {shift.warnings.map((warning) => (
              <p key={warning.kind} className="rounded-(--radius-sm) border border-warning/50 bg-warning/8 px-3 py-2 text-[0.875rem] text-warning">
                {warning.message}
              </p>
            ))}
          </div>
        ) : null}

        {canClockIn || canClockOut ? (
          <Section title="Clock">
            <div className="flex flex-wrap items-center gap-3">
              {canClockIn ? (
                <OneTap action={clockShift} fields={{ id: shift.id, direction: 'in' }}>
                  Clock in
                </OneTap>
              ) : null}
              {canClockOut ? (
                <OneTap action={clockShift} fields={{ id: shift.id, direction: 'out' }} variant="secondary">
                  Clock out
                </OneTap>
              ) : null}
              {shift.clockInAt ? <span className="text-[0.875rem] text-brown-soft">In at {formatClock(shift.clockInAt, shift.locationTimezone)}</span> : null}
            </div>
          </Section>
        ) : null}

        {shift.clockInAt || shift.attendanceStatus !== 'not_tracked' ? (
          <Section title="Attendance">
            <Facts
              items={[
                { label: 'Clocked in', value: shift.clockInAt ? formatClock(shift.clockInAt, shift.locationTimezone) : '—' },
                { label: 'Clocked out', value: shift.clockOutAt ? formatClock(shift.clockOutAt, shift.locationTimezone) : '—' },
                { label: 'Status', value: <Pill tone={shift.attendanceStatus === 'on_time' ? 'good' : shift.attendanceStatus === 'excused' || shift.attendanceStatus === 'not_tracked' ? 'neutral' : 'warn'}>{ATTENDANCE_LABEL[shift.attendanceStatus]}</Pill> },
                { label: 'Break', value: shift.breakMinutes ? `${shift.breakMinutes} min` : '—' },
              ]}
            />
            {shift.attendanceNote ? <p className="mt-2 text-[0.875rem] text-brown-soft">{shift.attendanceNote}</p> : null}
          </Section>
        ) : null}

        {firstShift ? (
          <Section title="Your first shift">
            <div className="staff-panel px-4 py-3">
              {firstShiftConfirmed ? (
                <p className="text-[0.9375rem] text-brown">Confirmed. See you there.</p>
              ) : (
                <>
                  <p className="text-[0.9375rem] text-brown">This is on your onboarding checklist: confirm you have seen it and can make it.</p>
                  <div className="mt-3">
                    <OneTap action={confirmFirstShift} fields={{}}>
                      I’ll be there
                    </OneTap>
                  </div>
                </>
              )}
            </div>
          </Section>
        ) : null}

        {mine && upcoming && shift.status === 'published' ? (
          <Section title="Need to change this?">
            <div className="staff-panel px-4 py-4">
              {request ? (
                <div>
                  <p className="text-[0.9375rem] text-brown">
                    You offered this shift ({request.kind === 'give_up' ? 'giving it up' : request.kind === 'swap' ? 'as a swap' : 'for cover'}).
                    {request.claimedByName ? ` ${request.claimedByName} asked for it; a manager decides.` : ' Nobody has claimed it yet.'}
                  </p>
                  <div className="mt-3">
                    <OneTap action={withdrawOffer} fields={{ id: request.id }} variant="secondary">
                      Keep the shift
                    </OneTap>
                  </div>
                </div>
              ) : (
                <OfferShift shiftId={shift.id} swapOptions={mySwapOptions.filter((entry) => entry.id !== shift.id).map((entry) => ({ id: entry.id, label: `${formatDayShort(entry.startsAt, entry.locationTimezone)} · ${formatShiftRange(entry.startsAt, entry.endsAt, entry.locationTimezone)} · ${entry.positionName}` }))} />
              )}
            </div>
          </Section>
        ) : null}

        {context.isManager ? (
          <Section title="Manage">
            <div className="flex flex-wrap gap-2">
              <a href={`/staff/schedule?week=${zonedDate(shift.startsAt, shift.locationTimezone)}&edit=${shift.id}`} className="inline-flex min-h-11 items-center rounded-(--radius-sm) border border-brown/30 px-4 text-[0.9375rem] font-semibold text-brown">Edit shift</a>
            </div>
          </Section>
        ) : null}

        {history.length > 1 ? (
          <Section title="History">
            <ul className="staff-panel px-4">
              {history.map((entry) => (
                <li key={entry.id} className="staff-row text-[0.875rem]">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold capitalize text-brown">{entry.reason}</span>
                    {entry.before && entry.after && entry.before.employeeId !== entry.after.employeeId ? <span className="block text-brown-soft">Moved between people</span> : null}
                    {entry.before && entry.after && entry.before.startsAt !== entry.after.startsAt ? <span className="block text-brown-soft">Time changed</span> : null}
                  </span>
                  <span className="shrink-0 text-brown-soft">{formatRelative(entry.changedAt)}</span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Comments entityType="shift" entityId={shift.id} comments={comments} />
      </Screen>
    </StaffShell>
  );
}
