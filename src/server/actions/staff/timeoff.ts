'use server';

import { formatDateRange } from '@/lib/staff/time';
import { recordOpsAudit } from '@/server/staff/audit';
import { withEmailDetails } from '@/server/staff/emails';
import { notify } from '@/server/staff/notifications';
import { decideTimeOff, requestTimeOff, withdrawTimeOff } from '@/server/staff/timeoff';
import { fail, isoDate, optional, runOps, savedOps, text, type ActionState } from './shared';

export async function submitTimeOff(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('timeoff.request', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const startsOn = isoDate(optional(form, 'startsOn'));
    const endsOn = isoDate(optional(form, 'endsOn')) ?? startsOn;
    if (!startsOn || !endsOn) return fail('Pick the dates.', { startsOn: 'Pick a date.' });
    if (endsOn < startsOn) return fail('The last day has to be on or after the first.', { endsOn: 'Ends before it starts.' });
    if (startsOn < new Date().toISOString().slice(0, 10)) return fail('Time off has to be in the future.', { startsOn: 'That date has passed.' });
    await requestTimeOff(db, employee.id, { startsOn, endsOn, reason: optional(form, 'reason'), note: optional(form, 'note') });
    return savedOps('Request sent. You will hear back from a manager.');
  });
}

export async function cancelTimeOff(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('timeoff.request', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    await withdrawTimeOff(db, employee.id, text(form, 'id'));
    return savedOps('Request withdrawn.');
  });
}

export async function decideTimeOffRequest(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('timeoff.approve', async ({ db, context }) => {
    const id = text(form, 'id');
    const decision = text(form, 'decision') === 'approved' ? 'approved' : 'denied';
    const note = optional(form, 'note');
    const { before, after } = await decideTimeOff(db, id, decision, note, context.staff, context.employee?.id ?? null);
    await recordOpsAudit(context.staff, `timeoff.${decision}`, 'time_off_request', id, { before, after: after as never });
    const range = formatDateRange(after.startsOn, after.endsOn);
    await notify(
      withEmailDetails(
        {
          employeeIds: [after.employeeId],
          kind: 'time_off_decided',
          title: decision === 'approved' ? `Your time off (${range}) was approved` : `Your time off (${range}) was not approved`,
          body: note,
          href: '/staff/time-off',
          entityType: 'time_off_request',
          entityId: id,
          email: { subject: 'Time-off decision', intro: decision === 'approved' ? 'Your request was approved. You will not be scheduled for those days.' : 'Your request was not approved this time. The manager’s note is below.', cta: 'View my requests' },
        },
        { headline: decision === 'approved' ? 'Your time off is approved.' : 'Your time off was not approved.', details: [{ label: 'Dates', value: range }, { label: 'Decided by', value: context.staff.name || 'A manager' }], note },
      ),
    );
    return savedOps(decision === 'approved' ? 'Approved. The employee has been told and the schedule will warn you if they are booked.' : 'Denied. The employee has been told.');
  });
}
