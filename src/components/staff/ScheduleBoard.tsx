import Link from 'next/link';
import type { EmployeeSummary, ShiftView, TimeOffRequest } from '@/content/staff-types';
import { formatShiftRange, zonedDate } from '@/lib/staff/time';
import { StaffIcon } from './icons';
import { Pill } from './ui';

/**
 * The week, as a board.
 *
 * On a laptop this is the thing a manager runs the restaurant from: people
 * down the side, days across the top, every shift in its cell, and an empty
 * cell you can click to fill. On a phone it is the same week read a day at
 * a time, because a seven-column grid on a 390px screen is a spreadsheet
 * nobody can tap.
 *
 * Deliberately not drag-and-drop. A shift has a person, a position, a time,
 * a location and sometimes an event; dragging expresses one of those five
 * and guesses at the rest. Tapping a cell opens the drawer already filled in
 * with the day and the person, which is the same two seconds and no guessing.
 */

export interface BoardLinks {
  /** Opens an existing shift. */
  shift: (id: string) => string;
  /** Opens a new shift, pre-filled. */
  add: (date: string, employeeId: string | null, positionId: string | null) => string;
}

function laneKey(shift: ShiftView): string {
  return shift.employeeId ?? 'open';
}

export function ScheduleBoard({
  days,
  today,
  timezone,
  shifts,
  employees,
  timeOff,
  links,
}: {
  days: string[];
  today: string;
  timezone: string;
  shifts: ShiftView[];
  employees: EmployeeSummary[];
  timeOff: TimeOffRequest[];
  links: BoardLinks;
}) {
  const byLane = new Map<string, ShiftView[]>();
  for (const shift of shifts) {
    const key = laneKey(shift);
    byLane.set(key, [...(byLane.get(key) ?? []), shift]);
  }
  // Everyone who is on this week, then everyone else who could be, then open.
  const scheduled = employees.filter((employee) => byLane.has(employee.id));
  const idle = employees.filter((employee) => !byLane.has(employee.id));
  const lanes: { id: string; name: string; detail: string }[] = [
    ...scheduled.map((employee) => ({ id: employee.id, name: employee.displayName, detail: employee.positionIds.join(', ') })),
    { id: 'open', name: 'Open shifts', detail: 'Anyone eligible can pick these up' },
    ...idle.map((employee) => ({ id: employee.id, name: employee.displayName, detail: 'Not on this week' })),
  ];

  return (
    <>
      {/* ------------------------------------------------ phone: day by day */}
      <div className="grid gap-3 lg:hidden">
        {days.map((day) => {
          const mine = shifts.filter((shift) => zonedDate(shift.startsAt, timezone) === day);
          const off = timeOff.filter((request) => day >= request.startsOn && day <= request.endsOn);
          return (
            <section key={day} className={`staff-panel px-4 py-3 ${day === today ? 'border-amber/50' : ''}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className={`text-[0.9375rem] font-semibold ${day === today ? 'text-amber' : 'text-brown'}`}>{dayLabel(day)}</h3>
                <Link href={links.add(day, null, null)} className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">
                  + Shift
                </Link>
              </div>
              {mine.length === 0 ? (
                <p className="mt-2 text-[0.875rem] text-brown-soft">Nobody scheduled.</p>
              ) : (
                <ul className="mt-1.5">
                  {mine
                    .slice()
                    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                    .map((shift) => (
                      <li key={shift.id}>
                        <Link href={links.shift(shift.id)} className="staff-row -mx-1 gap-3 px-1 active:bg-brown/6">
                          <span className="min-w-0 flex-1">
                            <span className="block text-[0.9375rem] font-semibold text-brown">{shift.employeeName ?? 'Open'}</span>
                            <span className="tabular mt-0.5 block text-[0.8125rem] text-brown-soft">
                              {formatShiftRange(shift.startsAt, shift.endsAt, timezone, { closeAfterMinutes: 4 * 60 })} · {shift.positionName}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {shift.status === 'draft' ? <Pill>Draft</Pill> : null}
                            {shift.status === 'cancelled' ? <Pill tone="bad">Cancelled</Pill> : null}
                            {shift.warnings.length > 0 ? <StaffIcon name="warning" className="size-[16px] text-warning" /> : null}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
              {off.length > 0 ? <p className="mt-2 text-[0.8125rem] text-brown-soft">Off: {off.map((request) => request.employeeName).join(', ')}</p> : null}
            </section>
          );
        })}
      </div>

      {/* --------------------------------------------- laptop: people × days */}
      <div className="hidden lg:block">
        <div className="staff-panel overflow-hidden">
          <div className="grid grid-cols-[13rem_repeat(7,minmax(0,1fr))] border-b border-brown/12 bg-brown/5">
            <div className="px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-brown-soft">Who</div>
            {days.map((day) => (
              <div key={day} className={`px-2 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] ${day === today ? 'text-amber' : 'text-brown-soft'}`}>
                {dayLabel(day)}
              </div>
            ))}
          </div>
          {lanes.map((lane) => {
            const mine = byLane.get(lane.id) ?? [];
            const off = lane.id === 'open' ? [] : timeOff.filter((request) => request.employeeId === lane.id);
            return (
              <div key={lane.id} className="grid grid-cols-[13rem_repeat(7,minmax(0,1fr))] border-b border-brown/10 last:border-b-0">
                <div className="min-w-0 border-r border-brown/10 px-3 py-2.5">
                  <p className="truncate text-[0.9375rem] font-semibold text-brown">{lane.name}</p>
                  <p className="truncate text-[0.75rem] text-brown-soft">{lane.detail}</p>
                </div>
                {days.map((day) => {
                  const cell = mine.filter((shift) => zonedDate(shift.startsAt, timezone) === day).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
                  const isOff = off.some((request) => day >= request.startsOn && day <= request.endsOn);
                  return (
                    <div key={day} className={`group flex min-h-[4.25rem] flex-col gap-1 border-r border-brown/8 p-1.5 last:border-r-0 ${day === today ? 'bg-amber/4' : ''}`}>
                      {cell.map((shift) => (
                        <BoardChip key={shift.id} shift={shift} timezone={timezone} href={links.shift(shift.id)} showName={lane.id === 'open'} />
                      ))}
                      {isOff && cell.length === 0 ? <span className="px-1 text-[0.6875rem] text-brown-soft/70">Time off</span> : null}
                      <Link
                        href={links.add(day, lane.id === 'open' ? null : lane.id, null)}
                        aria-label={`Add a shift for ${lane.name} on ${dayLabel(day)}`}
                        className="mt-auto flex min-h-6 items-center justify-center rounded-(--radius-sm) text-[0.875rem] text-transparent transition-colors hover:bg-brown/8 hover:text-brown-soft group-hover:text-brown-soft/50"
                      >
                        +
                      </Link>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

const CHIP: Record<string, string> = {
  cancelled: 'border-danger/45 bg-danger/8 text-danger line-through decoration-danger/50',
  draft: 'border-brown/30 bg-brown/6 text-brown-soft [background-image:repeating-linear-gradient(135deg,transparent,transparent_5px,rgb(255_255_255/0.03)_5px,rgb(255_255_255/0.03)_10px)]',
  open: 'border-amber/50 bg-amber/12 text-amber',
  live: 'border-brown/20 bg-brown/10 text-brown',
};

function BoardChip({ shift, timezone, href, showName }: { shift: ShiftView; timezone: string; href: string; showName: boolean }) {
  const tone = shift.status === 'cancelled' ? CHIP.cancelled! : shift.status === 'draft' ? CHIP.draft! : !shift.employeeId ? CHIP.open! : CHIP.live!;
  return (
    <Link href={href} className={`block rounded-(--radius-sm) border px-1.5 py-1 text-left text-[0.75rem] leading-tight transition-opacity hover:opacity-80 ${tone}`}>
      <span className="flex items-center gap-1">
        <span className="tabular truncate font-semibold">{formatShiftRange(shift.startsAt, shift.endsAt, timezone, { closeAfterMinutes: 4 * 60 })}</span>
        {shift.warnings.length > 0 ? <StaffIcon name="warning" className="size-[11px] shrink-0" /> : null}
      </span>
      <span className="block truncate opacity-80">{showName ? `${shift.positionName}` : shift.positionName}</span>
      {shift.event ? <span className="block truncate opacity-70">{shift.event.title}</span> : null}
    </Link>
  );
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(Date.UTC(y!, m! - 1, d!, 12));
  return `${WEEKDAY[at.getUTCDay()]} ${d}`;
}
