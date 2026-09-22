import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ShiftView } from '@/content/staff-types';
import { formatShiftRange } from '@/lib/staff/time';
import { StaffIcon } from './icons';

/**
 * A real calendar grid for shifts — a week of columns, or a month of cells —
 * instead of a vertical list of days. The grid only lays out; each page
 * decides what a day holds via a render prop, so "my schedule" and "build
 * the week" can show the same days differently.
 */

const WEEKDAY_MON_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayNumber(date: string): number {
  return Number(date.slice(8, 10));
}

export function CalendarWeek({ days, today, children }: { days: string[]; today: string; children: (day: string) => ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {days.map((day, index) => {
        const isToday = day === today;
        return (
          <div key={day} className={`staff-panel flex min-h-[6.5rem] flex-col gap-1.5 px-2 py-2 ${isToday ? 'border-amber/50' : ''}`}>
            <p className={`flex items-baseline gap-1 text-[0.75rem] font-semibold uppercase tracking-[0.06em] ${isToday ? 'text-amber' : 'text-brown-soft'}`}>
              {WEEKDAY_MON_FIRST[index]!}
              <span className="tabular text-[0.8125rem] normal-case tracking-normal">{dayNumber(day)}</span>
            </p>
            <div className="flex flex-1 flex-col gap-1">{children(day)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function CalendarMonth({ weeks, today, children }: { weeks: string[][]; today: string; children: (day: string) => ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-7 gap-1.5 px-0.5 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brown-soft">
        {WEEKDAY_MON_FIRST.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7 gap-1.5">
          {week.map((day) => {
            const isToday = day === today;
            return (
              <div key={day} className={`staff-panel flex min-h-[4.75rem] flex-col gap-1 px-1.5 py-1.5 ${isToday ? 'border-amber/50' : ''}`}>
                <p className={`tabular text-[0.75rem] font-semibold ${isToday ? 'text-amber' : 'text-brown-soft'}`}>{dayNumber(day)}</p>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">{children(day)}</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const CHIP_TONE: Record<string, string> = {
  cancelled: 'border-danger/45 bg-danger/8 text-danger line-through decoration-danger/50',
  draft: 'border-brown/25 bg-brown/6 text-brown-soft',
  open: 'border-amber/50 bg-amber/12 text-amber',
  default: 'border-brown/20 bg-brown/8 text-brown',
};

/** A shift, compact enough to sit inside a calendar cell. */
export function ShiftChip({ shift, href, label }: { shift: ShiftView; href?: string; label?: string }) {
  const tone = shift.status === 'cancelled' ? CHIP_TONE.cancelled! : shift.status === 'draft' ? CHIP_TONE.draft! : !shift.employeeId ? CHIP_TONE.open! : CHIP_TONE.default!;
  const range = formatShiftRange(shift.startsAt, shift.endsAt, shift.locationTimezone, { closeAfterMinutes: 4 * 60 });
  const body = (
    <span className={`block rounded-(--radius-sm) border px-1.5 py-1 text-left text-[0.75rem] leading-tight transition-opacity ${tone}`}>
      <span className="flex items-center gap-1">
        <span className="tabular truncate font-semibold">{range}</span>
        {shift.warnings.length > 0 ? <StaffIcon name="warning" className="size-[11px] shrink-0" /> : null}
      </span>
      {label ? <span className="block truncate opacity-80">{label}</span> : null}
    </span>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}
