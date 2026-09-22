import Link from 'next/link';
import type { ShiftView } from '@/content/staff-types';
import { formatDayLong, formatShiftRange } from '@/lib/staff/time';
import { Pill, Warning } from './ui';

/**
 * A shift, the way an employee reads it: the time first, then the position,
 * then where, then the event if there is one. The hero version is what the
 * home screen leads with; the compact one is a list row.
 */
export function ShiftHero({ shift, label = 'Today', href }: { shift: ShiftView; label?: string; href?: string }) {
  const range = formatShiftRange(shift.startsAt, shift.endsAt, shift.locationTimezone, { closeAfterMinutes: 4 * 60 });
  const body = (
    <div className="staff-panel border-amber/40 px-5 py-4">
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-amber">{label}</p>
      <p className="staff-figure mt-1 text-[2rem] text-brown">{range}</p>
      <p className="mt-1.5 text-[1.0625rem] font-semibold text-brown">{shift.positionName}</p>
      <p className="text-[0.9375rem] text-brown-soft">{shift.locationName}</p>
      {shift.event ? (
        <p className="mt-2 text-[0.9375rem] text-brown">
          <span className="text-brown-soft">Tonight: </span>
          {shift.event.title}
        </p>
      ) : null}
      {shift.note ? <p className="mt-2 rounded-(--radius-sm) bg-brown/8 px-3 py-2 text-[0.875rem] text-brown">{shift.note}</p> : null}
      {shift.clockInAt && !shift.clockOutAt ? (
        <p className="mt-2">
          <Pill tone="good">Clocked in</Pill>
        </p>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-transform active:scale-[0.995]">
      {body}
    </Link>
  ) : (
    body
  );
}

export function ShiftRow({ shift, href, showEmployee = false, showDate = true }: { shift: ShiftView; href?: string; showEmployee?: boolean; showDate?: boolean }) {
  const range = formatShiftRange(shift.startsAt, shift.endsAt, shift.locationTimezone);
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-brown">
          {showDate ? `${formatDayLong(shift.startsAt, shift.locationTimezone)} · ` : ''}
          <span className="tabular">{range}</span>
        </span>
        <span className="mt-0.5 block text-[0.8125rem] text-brown-soft">
          {showEmployee ? `${shift.employeeName ?? 'Open shift'} · ` : ''}
          {shift.positionName}
          {shift.event ? ` · ${shift.event.title}` : ''}
        </span>
        {shift.warnings.length > 0 ? (
          <span className="mt-1.5 block">
            {shift.warnings.map((warning) => (
              <Warning key={warning.kind}>{warning.message}</Warning>
            ))}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {shift.status === 'draft' ? <Pill>Draft</Pill> : null}
        {shift.status === 'cancelled' ? <Pill tone="bad">Cancelled</Pill> : null}
        {!shift.employeeId && shift.status === 'published' ? <Pill tone="accent">Open</Pill> : null}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="staff-row -mx-1 px-1 active:bg-brown/6">
      {body}
    </Link>
  ) : (
    <div className="staff-row">{body}</div>
  );
}
