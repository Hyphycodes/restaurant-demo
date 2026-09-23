import Link from 'next/link';
import type { ShiftView } from '@/content/staff-types';
import { formatClockShort, formatDate } from '@/lib/staff/time';
import type { FloorTonight } from './load';
import { Panel, Quiet, Section } from './parts';

/**
 * Who is working tonight, and which shifts nobody holds yet.
 *
 * Times are the venue's (the location's time zone, not the browser's), and a
 * shift that runs past midnight still belongs to tonight. When nobody is on,
 * the empty state looks ahead to the next night that has anyone, so the
 * section is never just a blank.
 */
export function OnTheFloor({ floor, roomOpen, now }: { floor: FloorTonight; roomOpen: boolean; now: Date }) {
  const { scheduled, open, coverage, nextNight, timeZone } = floor;
  const total = scheduled.length + open.length;
  const covering = new Map(coverage.map((request) => [request.shift.id, request]));

  return (
    <Section
      id="on-the-floor"
      title="On the floor tonight"
      link={{ href: '/staff/schedule', label: 'Schedule' }}
    >
      {total === 0 ? (
        <Quiet
          title={roomOpen ? 'Nobody is on the schedule tonight.' : 'Nobody is on tonight, and the room is resting.'}
        >
          {nextNight ? (
            <>
              <p>
                Next on the floor: <span className="font-semibold text-brown">{formatDate(nextNight.date)}</span>
                {' — '}
                {people(nextNight.scheduled.length)}
                {nextNight.open.length > 0 ? `, and ${nextNight.open.length === 1 ? 'one shift' : `${nextNight.open.length} shifts`} still open` : ''}.
              </p>
              {nextNight.scheduled.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {nextNight.scheduled.map((shift) => (
                    <li key={shift.id} className="rounded-full bg-brown/6 px-3 py-1 text-[0.8125rem] text-brown">
                      {firstName(shift.employeeName)} <span className="text-brown-soft">· {shift.positionName}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p>
              Nothing is scheduled for the week ahead either.{' '}
              <Link href="/staff/schedule" className="font-semibold text-brown underline underline-offset-4">
                Start the schedule
              </Link>
            </p>
          )}
        </Quiet>
      ) : (
        <Panel>
          <ul className="divide-y divide-brown/10">
            {scheduled.map((shift) => (
              <ShiftRow key={shift.id} shift={shift} timeZone={timeZone} now={now} coverRequestedBy={covering.get(shift.id)?.requestedByName ?? null} />
            ))}
            {open.map((shift) => (
              <ShiftRow key={shift.id} shift={shift} timeZone={timeZone} now={now} coverRequestedBy={null} />
            ))}
          </ul>
          <p className="tabular border-t border-brown/10 px-5 py-3 text-[0.8125rem] text-brown-soft sm:px-6">
            {people(scheduled.length)} on
            {open.length > 0 ? ` · ${open.length === 1 ? 'one shift' : `${open.length} shifts`} still open` : ' · every shift filled'}
            {coverage.length > 0 ? ` · ${coverage.length === 1 ? 'one person has' : `${coverage.length} people have`} asked for cover` : ''}
          </p>
        </Panel>
      )}
    </Section>
  );
}

function ShiftRow({ shift, timeZone, now, coverRequestedBy }: { shift: ShiftView; timeZone: string; now: Date; coverRequestedBy: string | null }) {
  const unfilled = !shift.employeeId;
  const started = Date.parse(shift.startsAt) <= now.getTime();
  const ended = Date.parse(shift.endsAt) <= now.getTime();
  const state = shift.clockOutAt
    ? 'Done'
    : shift.clockInAt
      ? `In since ${formatClockShort(shift.clockInAt, timeZone).toLowerCase().replace(' ', '')}`
      : ended
        ? 'Finished'
        : started
          ? 'On now'
          : null;

  return (
    <li className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-0.5 px-5 py-3.5 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:px-6">
      <span className="tabular text-[0.875rem] text-brown-soft">{clockRange(shift, timeZone)}</span>
      <span className="min-w-0">
        {unfilled ? (
          <span className="font-semibold text-warning">Unfilled</span>
        ) : (
          <span className="font-semibold text-brown">{shift.employeeName}</span>
        )}
        <span className="text-brown-soft"> · {shift.positionName}</span>
        {shift.event ? <span className="block truncate text-[0.8125rem] text-brown-soft">for {shift.event.title}</span> : null}
        {coverRequestedBy ? <span className="block text-[0.8125rem] text-warning">Asked for cover</span> : null}
      </span>
      <span className="col-start-2 text-[0.8125rem] sm:col-start-auto sm:text-right">
        {unfilled ? (
          <Link href="/staff/schedule" className="font-semibold text-brown underline underline-offset-4">
            Find someone
          </Link>
        ) : state ? (
          <span className={state === 'On now' || state.startsWith('In since') ? 'text-success' : 'text-brown-soft'}>{state}</span>
        ) : null}
      </span>
    </li>
  );
}

/** "4–11pm", "5pm–1:30am": the short form a manager writes on the board. */
function clockRange(shift: ShiftView, timeZone: string): string {
  const start = formatClockShort(shift.startsAt, timeZone);
  const end = formatClockShort(shift.endsAt, timeZone);
  const [startTime, startSuffix] = start.split(' ');
  const [endTime, endSuffix] = end.split(' ');
  const lower = (value: string | undefined) => (value ?? '').toLowerCase();
  return startSuffix === endSuffix
    ? `${startTime}–${endTime}${lower(endSuffix)}`
    : `${startTime}${lower(startSuffix)}–${endTime}${lower(endSuffix)}`;
}

function people(count: number): string {
  if (count === 0) return 'nobody';
  if (count === 1) return 'one person';
  return `${count} people`;
}

function firstName(name: string | null): string {
  return (name ?? 'Someone').split(' ')[0] ?? 'Someone';
}
