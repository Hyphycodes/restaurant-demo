'use server';

import type { StaffingRole } from '@/content/staff-types';
import { STAFFING_ROLE_LABEL } from '@/content/staff-types';
import { formatDayShort, formatShiftRange, minutesFromClock } from '@/lib/staff/time';
import { recordOpsAudit } from '@/server/staff/audit';
import { withEmailDetails } from '@/server/staff/emails';
import { getEventLite } from '@/server/staff/events';
import { locationMap, resolveLocation } from '@/server/staff/locations';
import { notify } from '@/server/staff/notifications';
import { getShiftView } from '@/server/staff/schedule';
import { assignToEvent, confirmAssignment, removeFromEvent } from '@/server/staff/staffing';
import { fail, optional, runOps, savedOps, text, type ActionState } from './shared';

const ROLES: StaffingRole[] = ['event_manager', 'dj', 'door', 'security', 'bartender', 'server', 'host', 'instructor', 'photographer', 'other'];

export async function assignEmployeeToEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('events.staff', async ({ db, context }) => {
    const eventId = text(form, 'eventId');
    const employeeId = text(form, 'employeeId');
    const role = text(form, 'role') as StaffingRole;
    if (!eventId || !employeeId) return fail('Pick a person.');
    if (!ROLES.includes(role)) return fail('Pick a role.');
    const event = await getEventLite(db, eventId);
    if (!event) return fail('That event no longer exists.');
    const location = resolveLocation(await locationMap(db), event.locationId);
    const start = optional(form, 'startTime');
    const end = optional(form, 'endTime');
    const row = await assignToEvent(db, { eventId, employeeId, role, startMinutes: start ? minutesFromClock(start) : null, endMinutes: end ? minutesFromClock(end) : null, note: optional(form, 'note') }, location.timezone, context.staff, context.location.id);
    await recordOpsAudit(context.staff, 'event.staffed', 'event', eventId, { after: { employeeId, role, shiftId: row.shift_id } });
    const shift = row.shift_id ? await getShiftView(db, String(row.shift_id)) : null;
    const when = shift ? `${formatDayShort(shift.startsAt, shift.locationTimezone)} · ${formatShiftRange(shift.startsAt, shift.endsAt, shift.locationTimezone)}` : formatDayShort(event.startsAt, location.timezone);
    await notify(
      withEmailDetails(
        { employeeIds: [employeeId], kind: 'event_assignment', title: `You are working ${event.title} — ${STAFFING_ROLE_LABEL[role]}`, body: optional(form, 'note'), href: '/staff/schedule', entityType: 'event', entityId: eventId, email: { subject: 'Event assignment', intro: `${context.staff.name || 'A manager'} put you on ${event.title}.`, cta: 'See the night' } },
        { headline: `You are working ${event.title}.`, details: [{ label: 'Event', value: event.title }, { label: 'When', value: when }, { label: 'Role', value: STAFFING_ROLE_LABEL[role] }, ...(event.doorsAt ? [{ label: 'Doors', value: formatShiftRange(event.doorsAt, event.doorsAt, location.timezone).split(' – ')[0]! }] : [])] },
      ),
    );
    return savedOps('Assigned. Their shift is on the schedule and they have been told.', [`/admin/events/one/${encodeURIComponent(eventId)}`]);
  });
}

export async function unassignFromEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('events.staff', async ({ db, context }) => {
    const id = text(form, 'id');
    const row = await removeFromEvent(db, id, context.staff);
    await recordOpsAudit(context.staff, 'event.unstaffed', 'event', String(row.event_id), { before: row });
    await notify({ employeeIds: [String(row.employee_id)], kind: 'shift_cancelled', title: 'You were taken off an event', href: '/staff/schedule', entityType: 'event', entityId: String(row.event_id) });
    return savedOps('Removed from the event. Their shift for it is cancelled.', [`/admin/events/one/${encodeURIComponent(String(row.event_id))}`]);
  });
}

export async function confirmEventAssignment(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('events.staff', async ({ db }) => {
    await confirmAssignment(db, text(form, 'id'));
    return savedOps('Confirmed.');
  });
}
