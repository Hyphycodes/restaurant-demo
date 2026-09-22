'use server';

import type { ShiftRequestKind } from '@/content/staff-types';
import { formatDayShort, formatShiftRange } from '@/lib/staff/time';
import { recordOpsAudit } from '@/server/staff/audit';
import { claimShiftRequest, decideShiftRequest, listShiftRequests, openShiftRequest, withdrawShiftRequest } from '@/server/staff/coverage';
import { listEmployees } from '@/server/staff/employees';
import { withEmailDetails } from '@/server/staff/emails';
import { notify } from '@/server/staff/notifications';
import { getShiftView } from '@/server/staff/schedule';
import { fail, optional, runOps, savedOps, text, type ActionState } from './shared';

export async function offerShift(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('coverage.request', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const kind = text(form, 'kind') as ShiftRequestKind;
    if (!['give_up', 'swap', 'cover'].includes(kind)) return fail('Pick what you want to do with the shift.');
    const shiftId = text(form, 'shiftId');
    const request = await openShiftRequest(db, employee.id, { shiftId, kind, note: optional(form, 'note'), swapShiftId: optional(form, 'swapShiftId') });
    const view = await getShiftView(db, shiftId);
    if (view) {
      // Everyone who works that position hears about it; managers see it on their dashboard.
      const eligible = (await listEmployees(db)).filter((entry) => entry.id !== employee.id && entry.positionIds.includes(view.positionId));
      await notify({
        employeeIds: eligible.map((entry) => entry.id),
        kind: 'swap_requested',
        title: `${employee.displayName} offered a ${view.positionName} shift: ${formatDayShort(view.startsAt, view.locationTimezone)} ${formatShiftRange(view.startsAt, view.endsAt, view.locationTimezone)}`,
        href: '/staff/schedule/coverage',
        entityType: 'shift_request',
        entityId: String(request.id),
      });
    }
    return savedOps('Your shift is up for grabs. Coworkers who work that position have been told; a manager approves the change.');
  });
}

export async function claimShift(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('coverage.request', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const id = text(form, 'id');
    const row = await claimShiftRequest(db, employee.id, id);
    const request = (await listShiftRequests(db)).find((entry) => entry.id === id);
    await notify({
      employeeIds: [String(row.requested_by)],
      kind: 'swap_claimed',
      title: `${employee.displayName} asked for your ${request?.shift.positionName ?? ''} shift`,
      href: '/staff/schedule/coverage',
      entityType: 'shift_request',
      entityId: id,
    });
    return savedOps('Asked for it. Once a manager approves, it moves to your schedule.');
  });
}

export async function withdrawOffer(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('coverage.request', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    await withdrawShiftRequest(db, employee.id, text(form, 'id'));
    return savedOps('Withdrawn. The shift stays yours.');
  });
}

export async function decideCoverage(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('coverage.approve', async ({ db, context }) => {
    const id = text(form, 'id');
    const decision = text(form, 'decision') === 'approved' ? 'approved' : 'denied';
    const note = optional(form, 'note');
    const { before, after } = await decideShiftRequest(db, id, decision, note, context.staff);
    await recordOpsAudit(context.staff, `coverage.${decision}`, 'shift_request', id, { before, after });
    const view = await getShiftView(db, String(after.shift_id));
    const when = view ? `${formatDayShort(view.startsAt, view.locationTimezone)} · ${formatShiftRange(view.startsAt, view.endsAt, view.locationTimezone)}` : '';
    const targets = [String(after.requested_by), after.claimed_by ? String(after.claimed_by) : null].filter((entry): entry is string => Boolean(entry));
    await notify(
      withEmailDetails(
        {
          employeeIds: targets,
          kind: decision === 'approved' ? 'shift_changed' : 'swap_decided',
          title: decision === 'approved' ? `Shift change approved: ${when}` : `Shift change not approved: ${when}`,
          body: note,
          href: '/staff/schedule',
          entityType: 'shift_request',
          entityId: id,
          email: decision === 'approved' ? { subject: 'Shift change approved', intro: 'A manager approved the shift change. Your schedule is updated.', cta: 'See my schedule' } : null,
        },
        { details: view ? [{ label: 'When', value: when }, { label: 'Position', value: view.positionName }, { label: 'Now on', value: view.employeeName ?? 'Open' }] : [] },
      ),
    );
    return savedOps(decision === 'approved' ? 'Approved. The schedule is updated and both people have been told.' : 'Denied. The shift stays where it was.');
  });
}
