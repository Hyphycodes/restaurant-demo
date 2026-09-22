'use server';

import type { AttendanceStatus, Shift, ShiftStatus } from '@/content/staff-types';
import { addDays, formatDate, formatDayShort, formatShiftRange, minutesFromClock, startOfWeek, weekOf, zonedDate } from '@/lib/staff/time';
import { recordOpsAudit } from '@/server/staff/audit';
import { withEmailDetails } from '@/server/staff/emails';
import { notify } from '@/server/staff/notifications';
import { claimOpenShift } from '@/server/staff/coverage';
import { clockIn, clockOut, copyWeek, correctAttendance, createShift, getShift, getShiftView, listShifts, publishWeek, repeatShift, setShiftStatus, updateShift, type ShiftInput } from '@/server/staff/schedule';
import { ensurePeriod, getPeriod, publishPeriod, weekBounds } from '@/server/staff/periods';
import { positionMap } from '@/server/staff/employees';
import { resolveLocation, locationMap } from '@/server/staff/locations';
import { fail, integer, isoDate, optional, runOps, savedOps, text, type ActionState } from './shared';

function shiftInputFrom(form: FormData): { input: ShiftInput; error: string | null } {
  const date = isoDate(optional(form, 'date'));
  const start = minutesFromClock(text(form, 'startTime'));
  const end = minutesFromClock(text(form, 'endTime'));
  const positionId = text(form, 'positionId');
  const locationId = text(form, 'locationId');
  if (!date) return { input: null as never, error: 'Pick a date.' };
  if (start === null || end === null) return { input: null as never, error: 'Enter a start and an end time.' };
  if (!positionId) return { input: null as never, error: 'Pick a position.' };
  if (!locationId) return { input: null as never, error: 'Pick a location.' };
  return {
    input: {
      locationId,
      employeeId: optional(form, 'employeeId'),
      positionId,
      date,
      startMinutes: start,
      endMinutes: end,
      eventId: optional(form, 'eventId'),
      note: optional(form, 'note'),
      status: (text(form, 'status') === 'published' ? 'published' : 'draft') as ShiftStatus,
    },
    error: null,
  };
}

async function tellEmployee(kind: 'shift_created' | 'shift_changed' | 'shift_cancelled', shiftId: string, note: string | null, wasEmployeeId: string | null = null): Promise<void> {
  const { opsReadDb } = await import('@/server/staff/db');
  const db = opsReadDb();
  if (!db) return;
  const view = await getShiftView(db, shiftId);
  if (!view) return;
  const when = `${formatDayShort(view.startsAt, view.locationTimezone)} · ${formatShiftRange(view.startsAt, view.endsAt, view.locationTimezone)}`;
  const targets = [view.employeeId, wasEmployeeId].filter((id): id is string => Boolean(id));
  if (targets.length === 0 || view.status === 'draft') return;
  const title = kind === 'shift_created' ? `New shift: ${when}` : kind === 'shift_cancelled' ? `Shift cancelled: ${when}` : `Shift changed: ${when}`;
  await notify(
    withEmailDetails(
      {
        employeeIds: targets,
        kind,
        title,
        body: note,
        href: '/staff/schedule',
        entityType: 'shift',
        entityId: shiftId,
        email: kind === 'shift_created' ? null : { subject: title, intro: kind === 'shift_cancelled' ? 'A manager cancelled one of your published shifts.' : 'A manager changed one of your published shifts.', cta: 'See my schedule' },
      },
      { details: [{ label: 'When', value: when }, { label: 'Position', value: view.positionName }, { label: 'Location', value: view.locationName }] },
    ),
  );
}

export async function saveShift(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('schedule.manage', async ({ db, context }) => {
    const { input, error } = shiftInputFrom(form);
    if (error) return fail(error);
    const timezone = resolveLocation(await locationMap(db), input.locationId).timezone;
    const id = optional(form, 'id');
    const repeatWeeks = integer(form, 'repeatWeeks') ?? 0;
    if (id) {
      const { before, after } = await updateShift(db, id, input, timezone, context.staff);
      await recordOpsAudit(context.staff, 'shift.edited', 'shift', id, { before: before as never, after: after as never });
      if (after.status === 'published') {
        const changed = before.startsAt !== after.startsAt || before.endsAt !== after.endsAt || before.employeeId !== after.employeeId || before.positionId !== after.positionId;
        if (changed) await tellEmployee('shift_changed', id, after.note, before.employeeId !== after.employeeId ? before.employeeId : null);
      }
      return savedOps('Shift saved.');
    }
    if (repeatWeeks > 0) {
      const created = await repeatShift(db, input, Math.min(repeatWeeks, 26), timezone, context.staff);
      await recordOpsAudit(context.staff, 'shift.repeated', 'shift', created[0]?.id ?? null, { after: { count: created.length, ...input } as never });
      for (const shift of created) await ensurePeriod(db, input.locationId, startOfWeek(zonedDate(shift.startsAt, timezone)));
      if (input.status === 'published') for (const shift of created) await tellEmployee('shift_created', shift.id, input.note);
      return savedOps(`${created.length} shifts added.`);
    }
    const shift = await createShift(db, input, timezone, context.staff);
    await recordOpsAudit(context.staff, 'shift.created', 'shift', shift.id, { after: shift as never });
    // Touching a week starts it, so staff see "being prepared" rather than
    // an empty week that looks like nobody is working.
    await ensurePeriod(db, input.locationId, startOfWeek(input.date));
    if (input.status === 'published') await tellEmployee('shift_created', shift.id, input.note);
    return savedOps(input.status === 'published' ? 'Shift published.' : 'Shift saved as a draft.');
  });
}

export async function cancelShift(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('schedule.manage', async ({ db, context }) => {
    const id = text(form, 'id');
    const { before, after } = await setShiftStatus(db, id, 'cancelled', context.staff);
    await recordOpsAudit(context.staff, 'shift.cancelled', 'shift', id, { before: before as never, after: after as never });
    if (before.status === 'published') await tellEmployee('shift_cancelled', id, optional(form, 'reason'));
    return savedOps('Shift cancelled.');
  });
}

export async function publishSchedule(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('schedule.publish', async ({ db, context }) => {
    const weekStart = isoDate(optional(form, 'weekStart'));
    const locationId = text(form, 'locationId');
    if (!weekStart || !locationId) return fail('Pick a week.');
    const location = resolveLocation(await locationMap(db), locationId);
    const week = weekOf(weekStart);
    const label = `${formatDate(week[0]!, 'short')} – ${formatDate(week[6]!, 'short')}`;

    // The week is the unit. Publishing releases every draft inside it and
    // marks the week live, so an employee's "next week is being prepared"
    // turns into "your schedule is live" in one step.
    let released: Shift[] = [];
    const result = await publishPeriod(db, locationId, week[0]!, location.timezone, context.staff, async (from, to) => {
      released = await publishWeek(db, locationId, from, to, context.staff);
      return released.length;
    });
    await recordOpsAudit(context.staff, 'schedule.published', 'schedule', `${locationId}:${week[0]!}`, {
      after: { count: result.released, week: week[0]!, firstRelease: result.firstRelease },
    });

    const { from, to } = weekBounds(week[0]!, location.timezone);
    const all = await listShifts(db, { from, to, locationId });
    // The first release tells everyone who is on the week. A later publish —
    // a manager adding a Thursday shift once the week is already out — tells
    // only the people whose shifts just appeared. Nobody hears twice.
    const audience = result.firstRelease ? all : released;
    const byEmployee = new Map<string, Shift[]>();
    for (const shift of audience) {
      if (!shift.employeeId) continue;
      byEmployee.set(shift.employeeId, [...(byEmployee.get(shift.employeeId) ?? []), shift]);
    }
    if (byEmployee.size === 0) {
      return savedOps(result.released === 0 ? `${label} is live. Nothing new to send.` : `${label} is live. ${result.released} shifts published.`);
    }

    const positions = await positionMap(db);
    const details = new Map<string, { headline: string; details: { label: string; value: string }[] }>();
    for (const [employeeId, shifts] of byEmployee) {
      details.set(employeeId, {
        headline: result.firstRelease ? `Your schedule for ${label} is live.` : `New shifts added to ${label}.`,
        details: shifts.map((shift) => ({
          label: formatDayShort(shift.startsAt, location.timezone),
          value: `${formatShiftRange(shift.startsAt, shift.endsAt, location.timezone)} · ${positions.get(shift.positionId)?.name ?? shift.positionId}`,
        })),
      });
    }
    await notify(
      withEmailDetails(
        {
          employeeIds: [...byEmployee.keys()],
          kind: 'schedule_published',
          title: result.firstRelease ? `Your Cosa Nostra schedule is live · ${label}` : `New shifts for you · ${label}`,
          href: `/staff/schedule?week=${week[0]!}`,
          entityType: 'schedule',
          entityId: `${locationId}:${week[0]!}`,
          email: {
            subject: result.firstRelease ? `Your Cosa Nostra schedule is live · ${label}` : `New shifts · ${label}`,
            intro: result.firstRelease ? `Your shifts for ${label} at ${location.name}.` : `A manager added shifts to ${label} at ${location.name}.`,
            cta: 'Open my schedule',
          },
        },
        details,
      ),
    );
    return savedOps(
      result.firstRelease
        ? `${label} is live. ${byEmployee.size} ${byEmployee.size === 1 ? 'person has' : 'people have'} been told.`
        : `${label} updated. ${byEmployee.size} ${byEmployee.size === 1 ? 'person' : 'people'} told about the new shifts.`,
    );
  });
}

/** Puts a week back into draft. Only possible while nobody has been told. */
export async function unpublishSchedule(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('schedule.publish', async ({ db, context }) => {
    const weekStart = isoDate(optional(form, 'weekStart'));
    const locationId = text(form, 'locationId');
    if (!weekStart || !locationId) return fail('Pick a week.');
    const week = weekOf(weekStart)[0]!;
    const period = await getPeriod(db, locationId, week);
    if (!period || period.status !== 'published') return fail('That week is already a draft.');
    if (period.notifiedAt) return fail('That week has already gone out to staff. Cancel the individual shifts instead — taking the whole week back would be worse than confusing.');
    await db.update('schedule_periods', period.id, { status: 'draft', published_at: null });
    await recordOpsAudit(context.staff, 'schedule.unpublished', 'schedule', `${locationId}:${week}`, { before: { status: 'published' } });
    return savedOps('Back to draft.');
  });
}

export async function copySchedule(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('schedule.manage', async ({ db, context }) => {
    const weekStart = isoDate(optional(form, 'weekStart'));
    const locationId = text(form, 'locationId');
    if (!weekStart || !locationId) return fail('Pick a week.');
    const location = resolveLocation(await locationMap(db), locationId);
    const target = addDays(startOfWeek(weekStart), 7);
    const copied = await copyWeek(db, locationId, weekStart, location.timezone, context.staff);
    await recordOpsAudit(context.staff, 'schedule.copied', 'schedule', `${locationId}:${weekStart}`, { after: { count: copied, into: target } });
    if (copied > 0) await ensurePeriod(db, locationId, target);
    return savedOps(copied === 0 ? 'Nothing to copy from that week.' : `${copied} shifts copied into ${formatDate(target, 'short')} as drafts. Check them, then publish.`);
  });
}

export async function saveAttendance(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('schedule.manage', async ({ db, context }) => {
    const id = text(form, 'id');
    const status = text(form, 'attendanceStatus') as AttendanceStatus;
    const { before, after } = await correctAttendance(db, id, {
      clockInAt: optional(form, 'clockInAt'),
      clockOutAt: optional(form, 'clockOutAt'),
      breakMinutes: integer(form, 'breakMinutes') ?? 0,
      attendanceStatus: ['not_tracked', 'on_time', 'late', 'absent', 'left_early', 'excused'].includes(status) ? status : 'not_tracked',
      note: optional(form, 'note'),
    }, context.staff);
    await recordOpsAudit(context.staff, 'attendance.corrected', 'shift', id, { before: before as never, after: after as never });
    return savedOps('Attendance saved.');
  });
}

/** The employee's own clock. Allowed from an hour before the shift until an hour after. */
export async function clockShift(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('schedule.view_self', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const shift = await getShift(db, text(form, 'id'));
    if (!shift || shift.employeeId !== employee.id) return fail('That shift is not yours.');
    const now = new Date();
    const direction = text(form, 'direction');
    if (direction === 'in') {
      if (shift.clockInAt) return fail('You are already clocked in.');
      if (now.getTime() < Date.parse(shift.startsAt) - 60 * 60_000) return fail('You can clock in from an hour before your shift.');
      await clockIn(db, shift, now);
      return savedOps('Clocked in. Have a good one.');
    }
    if (!shift.clockInAt) return fail('Clock in first.');
    if (shift.clockOutAt) return fail('You are already clocked out.');
    await clockOut(db, shift, now);
    return savedOps('Clocked out. Thanks for tonight.');
  });
}

export async function confirmFirstShift(): Promise<ActionState> {
  return runOps('schedule.view_self', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    await db.update('employees', employee.id, { first_shift_confirmed_at: new Date().toISOString() });
    return savedOps('First shift confirmed. See you there.');
  });
}

export async function pickUpOpenShift(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('coverage.request', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    const shift = await getShift(db, text(form, 'id'));
    if (!shift || shift.employeeId || shift.status !== 'published') return fail('That shift is no longer open.');
    if (!employee.positionIds.includes(shift.positionId)) return fail('That shift is for a position you are not set up for.');
    await claimOpenShift(db, employee.id, shift.id);
    return savedOps('Asked for it. A manager will confirm and it will show on your schedule.');
  });
}

export async function updateShiftStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('schedule.manage', async ({ db, context }) => {
    const id = text(form, 'id');
    const status = text(form, 'status') as ShiftStatus;
    if (!['draft', 'published', 'cancelled'].includes(status)) return fail('Unknown status.');
    const { before, after } = await setShiftStatus(db, id, status, context.staff);
    await recordOpsAudit(context.staff, `shift.${status}`, 'shift', id, { before: before as never, after: after as never });
    if (status === 'published' && before.status !== 'published') await tellEmployee('shift_created', id, after.note);
    if (status === 'cancelled' && before.status === 'published') await tellEmployee('shift_cancelled', id, null);
    return savedOps(status === 'published' ? 'Published.' : status === 'cancelled' ? 'Cancelled.' : 'Back to draft.');
  });
}
