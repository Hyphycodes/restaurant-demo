import Link from 'next/link';
import { OneTap } from '@/components/staff/forms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Button, Chips, Empty, Pill, Screen, Section } from '@/components/staff/ui';
import { SHIFT_REQUEST_KIND_LABEL } from '@/content/staff-types';
import { formatDayLong, formatRelative, formatShiftRange, zonedDate } from '@/lib/staff/time';
import { claimShift, decideCoverage, withdrawOffer } from '@/server/actions/staff/coverage';
import { pickUpOpenShift } from '@/server/actions/staff/schedule';
import { listShiftRequests } from '@/server/staff/coverage';
import { listShiftViews } from '@/server/staff/schedule';
import { contextCan } from '@/server/staff/session';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

/**
 * Shifts looking for someone.
 *
 * One screen for both sides of the same conversation: an employee sees what
 * they could pick up and what they have offered; a manager sees the same
 * list with the decision on it. Nobody needs a different destination to
 * answer "can someone take my Saturday".
 */
export default async function CoveragePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const page = await staffPage('coverage.request');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { show } = await searchParams;
  const employee = context.employee;
  const decides = contextCan(context, 'coverage.approve');
  const now = new Date();

  const [requests, openShifts] = await Promise.all([
    listShiftRequests(db, { status: show === 'decided' ? ['approved', 'denied', 'cancelled'] : ['open', 'claimed'] }),
    listShiftViews(db, {
      from: now.toISOString(),
      to: new Date(now.getTime() + 45 * 86_400_000).toISOString(),
      locationId: context.location.id,
      openOnly: true,
    }),
  ]);

  // An employee is shown what is relevant to them: their own offers, and
  // anything they are actually qualified to take. A manager sees all of it.
  const eligible = (positionId: string) => decides || (employee?.positionIds.includes(positionId) ?? false);
  const mine = requests.filter((request) => request.requestedBy === employee?.id || request.claimedBy === employee?.id);
  const others = requests.filter((request) => !mine.includes(request) && eligible(request.shift.positionId));
  const grabbable = openShifts.filter((shift) => eligible(shift.positionId));

  return (
    <StaffShell context={context} unread={unread}>
      <Screen
        title="Up for grabs"
        lead={decides ? 'Every offer and open shift. Yours to approve.' : 'Shifts your coworkers need covered, and shifts nobody has yet.'}
        actions={<Button href="/staff/schedule" small>Schedule</Button>}
      >
        <Chips
          items={[
            { href: '/staff/schedule/coverage', label: 'Open', active: show !== 'decided', count: requests.length || undefined },
            { href: '/staff/schedule/coverage?show=decided', label: 'Decided', active: show === 'decided' },
          ]}
        />

        {mine.length > 0 ? (
          <Section title="Yours">
            <div className="staff-panel px-4">
              {mine.map((request) => (
                <div key={request.id} className="staff-row flex-wrap gap-y-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold text-brown">
                      {formatDayLong(request.shift.startsAt, request.shift.locationTimezone)} · {formatShiftRange(request.shift.startsAt, request.shift.endsAt, request.shift.locationTimezone)}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] text-brown-soft">
                      {request.shift.positionName} · {SHIFT_REQUEST_KIND_LABEL[request.kind]}
                      {request.requestedBy === employee?.id
                        ? request.claimedByName
                          ? ` · ${request.claimedByName} asked for it`
                          : ' · nobody yet'
                        : ' · you asked for it'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Pill tone={request.status === 'claimed' ? 'accent' : request.status === 'approved' ? 'good' : request.status === 'denied' ? 'bad' : 'neutral'}>{request.status}</Pill>
                    {request.requestedBy === employee?.id && (request.status === 'open' || request.status === 'claimed') ? (
                      <OneTap action={withdrawOffer} fields={{ id: request.id }} variant="quiet">
                        Keep it
                      </OneTap>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {others.length > 0 ? (
          <Section title={decides ? 'Waiting on a manager' : 'Your coworkers need cover'}>
            <div className="staff-panel px-4">
              {others.map((request) => (
                <div key={request.id} className="staff-row flex-wrap gap-y-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold text-brown">
                      {request.requestedByName} · {formatDayLong(request.shift.startsAt, request.shift.locationTimezone)}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] text-brown-soft">
                      {formatShiftRange(request.shift.startsAt, request.shift.endsAt, request.shift.locationTimezone)} · {request.shift.positionName}
                      {request.claimedByName ? ` · ${request.claimedByName} wants it` : ''}
                      {request.note ? ` · “${request.note}”` : ''}
                    </span>
                    <span className="mt-0.5 block text-[0.75rem] text-brown-soft/80">Offered {formatRelative(request.createdAt)}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-2">
                    {/* Only someone who actually works that position can take
                        it — the server refuses otherwise, and offering a
                        manager a bartender's Saturday is just noise. */}
                    {request.status === 'open' && employee && employee.positionIds.includes(request.shift.positionId) ? (
                      <OneTap action={claimShift} fields={{ id: request.id }}>
                        I’ll take it
                      </OneTap>
                    ) : null}
                    {decides && (request.claimedBy || request.kind === 'give_up') ? (
                      <OneTap action={decideCoverage} fields={{ id: request.id, decision: 'approved' }} variant="secondary">
                        Approve
                      </OneTap>
                    ) : null}
                    {decides ? (
                      <OneTap action={decideCoverage} fields={{ id: request.id, decision: 'denied' }} variant="quiet">
                        Deny
                      </OneTap>
                    ) : null}
                    {!decides && !(request.status === 'open' && employee?.positionIds.includes(request.shift.positionId)) ? <Pill tone="accent">{request.status}</Pill> : null}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {show !== 'decided' && grabbable.length > 0 ? (
          <Section title="Open shifts" count={grabbable.length}>
            <div className="staff-panel px-4">
              {grabbable.map((shift) => (
                <div key={shift.id} className="staff-row flex-wrap gap-y-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold text-brown">
                      {formatDayLong(shift.startsAt, shift.locationTimezone)} · {formatShiftRange(shift.startsAt, shift.endsAt, shift.locationTimezone)}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] text-brown-soft">
                      {shift.positionName} · {shift.locationName}
                      {shift.event ? ` · ${shift.event.title}` : ''}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {employee?.positionIds.includes(shift.positionId) ? (
                      <OneTap action={pickUpOpenShift} fields={{ id: shift.id }}>
                        Pick it up
                      </OneTap>
                    ) : null}
                    {decides ? (
                      <Link href={`/staff/schedule?week=${zonedDate(shift.startsAt, shift.locationTimezone)}&edit=${shift.id}`} className="text-[0.875rem] font-semibold text-brown underline underline-offset-4">
                        Assign
                      </Link>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {mine.length === 0 && others.length === 0 && (show === 'decided' || grabbable.length === 0) ? (
          <Empty
            title={show === 'decided' ? 'Nothing decided yet.' : 'Nothing up for grabs.'}
            detail={show === 'decided' ? undefined : 'Every shift has someone on it. Offer one of yours from its page if you need to.'}
            action={<Button href="/staff/schedule">My schedule</Button>}
          />
        ) : null}
      </Screen>
    </StaffShell>
  );
}
