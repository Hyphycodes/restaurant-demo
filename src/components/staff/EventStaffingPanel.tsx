import Link from 'next/link';
import type { EmployeeSummary, EventStaffing } from '@/content/staff-types';
import { STAFFING_ROLE_LABEL } from '@/content/staff-types';
import { formatClockShort, formatDayLong, formatPrice } from './format';
import { confirmEventAssignment, unassignFromEvent } from '@/server/actions/staff/staffing';
import { markPaid } from '@/server/actions/staff/contractors';
import { OneTap } from './forms';
import { AssignToEventForm } from './manage/MoreForms';
import { Pill, Section } from './ui';

/**
 * The staffing section of an event: who is working, in what role, when,
 * whether they are ready for it, the contractors booked, the tasks open.
 * Rendered on the admin's event page and in the staff app's event screen
 * from the same data, so the two can never disagree.
 */
export function EventStaffingPanel({ staffing, employees, timezone, canStaff, compact = false }: { staffing: EventStaffing; employees: EmployeeSummary[]; timezone: string; canStaff: boolean; compact?: boolean }) {
  const { event, assignments, bookings, tasks, gaps } = staffing;
  return (
    <div className="grid gap-5">
      {!compact ? (
        <p className="text-[0.9375rem] text-brown-soft">
          {formatDayLong(event.startsAt, timezone)} · {event.doorsAt ? `Doors ${formatClockShort(event.doorsAt, timezone)} · ` : ''}
          {formatClockShort(event.startsAt, timezone)} – {formatClockShort(event.endsAt, timezone)}
          {event.ticketsSold !== null ? ` · ${event.ticketsSold} tickets sold` : ''}
        </p>
      ) : null}

      {gaps.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {gaps.map((role) => (
            <Pill key={role} tone="warn">
              {STAFFING_ROLE_LABEL[role]} unassigned
            </Pill>
          ))}
        </div>
      ) : (
        <Pill tone="good">Manager, door and bar covered</Pill>
      )}

      <Section title="Who’s working" count={assignments.length + bookings.length}>
        <div className="staff-panel px-4">
          {assignments.length + bookings.length === 0 ? <p className="py-3 text-[0.875rem] text-brown-soft">Nobody assigned yet.</p> : null}
          {assignments.map((assignment) => (
            <div key={assignment.id} className="staff-row flex-wrap">
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold text-brown">
                  {STAFFING_ROLE_LABEL[assignment.role]}: <Link href={`/staff/team/${assignment.employeeId}`} className="underline-offset-4 hover:underline">{assignment.employeeName}</Link>
                </span>
                <span className="block text-[0.8125rem] text-brown-soft">
                  {assignment.shiftId ? <Link href={`/staff/schedule?edit=${assignment.shiftId}`} className="underline underline-offset-4">Shift on the schedule</Link> : 'No shift'}
                  {assignment.note ? ` · ${assignment.note}` : ''}
                </span>
                {assignment.readiness.length > 0 ? <span className="mt-1 block text-[0.8125rem] text-warning">⚠ {assignment.readiness.join(' · ')}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                <Pill tone={assignment.status === 'confirmed' ? 'good' : 'neutral'}>{assignment.status}</Pill>
                {canStaff && assignment.status !== 'confirmed' ? (
                  <OneTap action={confirmEventAssignment} fields={{ id: assignment.id }} variant="quiet" quiet>
                    Confirm
                  </OneTap>
                ) : null}
                {canStaff ? (
                  <OneTap action={unassignFromEvent} fields={{ id: assignment.id }} variant="quiet" quiet confirm={`Take ${assignment.employeeName} off this event? Their shift for it is cancelled.`}>
                    Remove
                  </OneTap>
                ) : null}
              </span>
            </div>
          ))}
          {bookings.map((booking) => (
            <div key={booking.id} className="staff-row flex-wrap">
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold text-brown">
                  {STAFFING_ROLE_LABEL[booking.role === 'painter' || booking.role === 'instructor' ? 'instructor' : booking.role === 'dj' ? 'dj' : booking.role === 'security' ? 'security' : booking.role === 'photographer' ? 'photographer' : 'other']}: <Link href={`/staff/contractors/${booking.contractorId}`} className="underline-offset-4 hover:underline">{booking.contractorName}</Link> <span className="font-normal text-brown-soft">(contractor)</span>
                </span>
                <span className="block text-[0.8125rem] text-brown-soft">
                  {booking.startsAt ? `Arrives ${formatClockShort(booking.startsAt, timezone)} · ` : ''}
                  {booking.agreedCents ? `${formatPrice(booking.agreedCents)} agreed · ` : ''}
                  {booking.paymentStatus === 'paid' ? 'paid' : booking.paymentStatus === 'deposit_paid' ? `deposit paid (${formatPrice(booking.paidCents)})` : 'unpaid'}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Pill tone={booking.status === 'confirmed' ? 'good' : booking.status === 'cancelled' ? 'bad' : 'neutral'}>{booking.status}</Pill>
                {canStaff && booking.paymentStatus !== 'paid' && booking.agreedCents > 0 ? (
                  <OneTap action={markPaid} fields={{ id: booking.id }} variant="quiet" quiet confirm={`Mark ${formatPrice(booking.agreedCents)} to ${booking.contractorName} as paid?`}>
                    Mark paid
                  </OneTap>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {canStaff ? (
        <Section title="Assign someone">
          <div className="staff-panel px-4 py-3">
            <AssignToEventForm eventId={event.id} employees={employees} />
            <p className="mt-2 text-[0.8125rem] text-brown-soft">
              Assigning creates their shift for the night and tells them. To book a DJ or an instructor, <Link href={`/staff/contractors?book=${encodeURIComponent(event.id)}`} className="font-semibold text-brown underline underline-offset-4">book a contractor</Link>.
            </p>
          </div>
        </Section>
      ) : null}

      {tasks.length > 0 || canStaff ? (
        <Section title="Tasks for this event" count={tasks.length} action={canStaff ? <Link href={`/staff/operations/tasks/new?event=${encodeURIComponent(event.id)}`} className="text-[0.8125rem] font-semibold text-brown-soft underline underline-offset-4">+ Task</Link> : undefined}>
          {tasks.length === 0 ? <p className="text-[0.875rem] text-brown-soft">No open tasks.</p> : (
            <div className="staff-panel px-4">
              {tasks.map((task) => (
                <Link key={task.id} href={`/staff/tasks/${task.id}`} className="staff-row -mx-1 px-1">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-semibold text-brown">{task.title}</span>
                    <span className="block text-[0.8125rem] text-brown-soft">{task.assignedToName ?? 'Unassigned'}</span>
                  </span>
                  {task.overdue ? <Pill tone="bad">Overdue</Pill> : <Pill>{task.status.replace('_', ' ')}</Pill>}
                </Link>
              ))}
            </div>
          )}
        </Section>
      ) : null}
    </div>
  );
}
