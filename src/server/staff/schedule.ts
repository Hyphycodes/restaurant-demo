import 'server-only';

import type { AttendanceStatus, EmployeeSummary, LocationSummary, Position, ScheduleWarning, Shift, ShiftStatus, ShiftView } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import { scheduleWarnings } from '@/lib/staff/conflicts';
import { addDays, zonedDate, zonedInstant } from '@/lib/staff/time';
import type { Staff } from '@/server/auth';
import { listAvailabilityFor } from './availability';
import { employeeMap } from './employees';
import { locationMap, resolveLocation } from './locations';
import { positionMap } from './employees';
import { eventSummaries, type EventSummaryLite } from './events';
import { listTimeOff } from './timeoff';

/**
 * Shifts: the schedule as data.
 *
 * A shift is an instant range at a location, in a position, optionally for
 * a person and optionally tied to an event. Drafts are a manager's working
 * copy; publishing is what an employee sees and is told about. Every write
 * that changes a shift someone could be relying on records the before and
 * after in `shift_history`, so a reassignment is never a mystery.
 */

export function shiftFromRow(row: Row): Shift {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    employeeId: (row.employee_id as string | null) ?? null,
    positionId: String(row.position_id),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    eventId: (row.event_id as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    status: (row.status as ShiftStatus) ?? 'draft',
    publishedAt: (row.published_at as string | null) ?? null,
    repeatGroupId: (row.repeat_group_id as string | null) ?? null,
    clockInAt: (row.clock_in_at as string | null) ?? null,
    clockOutAt: (row.clock_out_at as string | null) ?? null,
    breakMinutes: Number(row.break_minutes ?? 0),
    attendanceStatus: (row.attendance_status as AttendanceStatus) ?? 'not_tracked',
    attendanceNote: (row.attendance_note as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export interface ScheduleContext {
  employees: Map<string, EmployeeSummary>;
  positions: Map<string, Position>;
  locations: Map<string, LocationSummary>;
  events: Map<string, EventSummaryLite>;
}

export async function scheduleContext(db: Db, eventIds: string[] = []): Promise<ScheduleContext> {
  const [employees, positions, locations, events] = await Promise.all([employeeMap(db), positionMap(db), locationMap(db), eventSummaries(db, eventIds)]);
  return { employees, positions, locations, events };
}

export function toShiftView(shift: Shift, context: ScheduleContext, warnings: ScheduleWarning[] = []): ShiftView {
  const location = resolveLocation(context.locations, shift.locationId);
  const event = shift.eventId ? (context.events.get(shift.eventId) ?? null) : null;
  return {
    ...shift,
    employeeName: shift.employeeId ? (context.employees.get(shift.employeeId)?.displayName ?? null) : null,
    positionName: context.positions.get(shift.positionId)?.name ?? shift.positionId,
    locationName: location.shortName,
    locationTimezone: location.timezone,
    event: event ? { id: event.id, title: event.title, slug: event.slug, startsAt: event.startsAt, doorsAt: event.doorsAt } : null,
    warnings,
  };
}

export interface ShiftQuery {
  from: string;
  to: string;
  locationId?: string | null;
  employeeId?: string | null;
  includeDrafts?: boolean;
  includeCancelled?: boolean;
  openOnly?: boolean;
}

/** Shifts starting inside [from, to), instants as ISO. */
export async function listShifts(db: Db, query: ShiftQuery): Promise<Shift[]> {
  const where: Record<string, string | null> = {};
  if (query.locationId) where.location_id = query.locationId;
  if (query.employeeId) where.employee_id = query.employeeId;
  if (query.openOnly) where.employee_id = null;
  const rows = await db.list<Row>('shifts', { where, range: { column: 'starts_at', from: query.from, to: query.to }, orderBy: 'starts_at' });
  return rows
    .filter((row) => !row.archived_at)
    .map(shiftFromRow)
    .filter((shift) => query.includeDrafts || shift.status !== 'draft')
    .filter((shift) => query.includeCancelled || shift.status !== 'cancelled');
}

export async function listShiftViews(db: Db, query: ShiftQuery, options: { withWarnings?: boolean } = {}): Promise<ShiftView[]> {
  const shifts = await listShifts(db, query);
  const context = await scheduleContext(db, shifts.map((shift) => shift.eventId).filter((id): id is string => Boolean(id)));
  if (!options.withWarnings) return shifts.map((shift) => toShiftView(shift, context));
  const warnings = await warningsForShifts(db, shifts, context);
  return shifts.map((shift) => toShiftView(shift, context, warnings.get(shift.id) ?? []));
}

export async function getShift(db: Db, id: string): Promise<Shift | null> {
  const row = await db.get<Row>('shifts', id);
  return row && !row.archived_at ? shiftFromRow(row) : null;
}

export async function getShiftView(db: Db, id: string, options: { withWarnings?: boolean } = {}): Promise<ShiftView | null> {
  const shift = await getShift(db, id);
  if (!shift) return null;
  const context = await scheduleContext(db, shift.eventId ? [shift.eventId] : []);
  const warnings = options.withWarnings ? (await warningsForShifts(db, [shift], context)).get(shift.id) ?? [] : [];
  return toShiftView(shift, context, warnings);
}

/** Every warning for every shift, computed against each employee's rules and other shifts. */
export async function warningsForShifts(db: Db, shifts: Shift[], context: ScheduleContext): Promise<Map<string, ScheduleWarning[]>> {
  const result = new Map<string, ScheduleWarning[]>();
  const byEmployee = new Map<string, Shift[]>();
  for (const shift of shifts) {
    if (!shift.employeeId) continue;
    byEmployee.set(shift.employeeId, [...(byEmployee.get(shift.employeeId) ?? []), shift]);
  }
  for (const [employeeId, mine] of byEmployee) {
    const employee = context.employees.get(employeeId);
    if (!employee) continue;
    const [availability, timeOff, others] = await Promise.all([
      listAvailabilityFor(db, employeeId),
      listTimeOff(db, { employeeId }),
      db.list<Row>('shifts', { where: { employee_id: employeeId } }),
    ]);
    const otherShifts = others.filter((row) => !row.archived_at).map(shiftFromRow);
    for (const shift of mine) {
      const location = resolveLocation(context.locations, shift.locationId);
      const warnings = scheduleWarnings({
        employeeName: employee.displayName,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        timezone: location.timezone,
        rules: availability.rules,
        exceptions: availability.exceptions,
        timeOff,
        otherShifts: otherShifts.filter((other) => other.id !== shift.id),
      });
      if (employee.status === 'inactive' || employee.archivedAt) {
        warnings.unshift({ kind: 'inactive', message: `${employee.displayName} is no longer active.` });
      }
      if (warnings.length > 0) result.set(shift.id, warnings);
    }
  }
  return result;
}

/* ------------------------------------------------------------------ writes */

export interface ShiftInput {
  locationId: string;
  employeeId: string | null;
  positionId: string;
  /** Local date and minutes in the location's zone. */
  date: string;
  startMinutes: number;
  endMinutes: number;
  eventId: string | null;
  note: string | null;
  status: ShiftStatus;
}

/** The two instants for a local date, start and end minutes; an end at or before the start is the next day. */
export function shiftInstants(input: { date: string; startMinutes: number; endMinutes: number }, timezone: string): { startsAt: string; endsAt: string } {
  const startsAt = zonedInstant(input.date, input.startMinutes, timezone);
  const endDate = input.endMinutes <= input.startMinutes ? addDays(input.date, 1) : input.date;
  const endsAt = zonedInstant(endDate, input.endMinutes, timezone);
  return { startsAt, endsAt };
}

async function history(db: Db, shiftId: string, actor: Staff, reason: string, before: Row | null, after: Row | null): Promise<void> {
  await db.insert('shift_history', {
    shift_id: shiftId,
    changed_by: actor.source === 'supabase' ? actor.id : null,
    changed_at: new Date().toISOString(),
    reason,
    before,
    after,
  });
}

export async function createShift(db: Db, input: ShiftInput, timezone: string, actor: Staff, repeatGroupId: string | null = null): Promise<Shift> {
  const { startsAt, endsAt } = shiftInstants(input, timezone);
  const now = new Date().toISOString();
  const row = await db.insert<Row>('shifts', {
    location_id: input.locationId,
    employee_id: input.employeeId,
    position_id: input.positionId,
    starts_at: startsAt,
    ends_at: endsAt,
    event_id: input.eventId,
    note: input.note,
    status: input.status,
    published_at: input.status === 'published' ? now : null,
    repeat_group_id: repeatGroupId,
    break_minutes: 0,
    attendance_status: 'not_tracked',
    created_by: actor.source === 'supabase' ? actor.id : null,
    updated_by: actor.source === 'supabase' ? actor.id : null,
    created_at: now,
  });
  await history(db, String(row.id), actor, 'created', null, row);
  return shiftFromRow(row);
}

export async function updateShift(db: Db, id: string, input: ShiftInput, timezone: string, actor: Staff, reason = 'edited'): Promise<{ before: Shift; after: Shift }> {
  const existing = await db.get<Row>('shifts', id);
  if (!existing) throw new Error('That shift no longer exists.');
  const { startsAt, endsAt } = shiftInstants(input, timezone);
  const publishedAt = input.status === 'published' ? (existing.published_at as string | null) ?? new Date().toISOString() : (existing.published_at as string | null) ?? null;
  const row = await db.update<Row>('shifts', id, {
    location_id: input.locationId,
    employee_id: input.employeeId,
    position_id: input.positionId,
    starts_at: startsAt,
    ends_at: endsAt,
    event_id: input.eventId,
    note: input.note,
    status: input.status,
    published_at: publishedAt,
    updated_by: actor.source === 'supabase' ? actor.id : null,
  });
  await history(db, id, actor, reason, existing, row);
  return { before: shiftFromRow(existing), after: shiftFromRow(row) };
}

export async function setShiftStatus(db: Db, id: string, status: ShiftStatus, actor: Staff): Promise<{ before: Shift; after: Shift }> {
  const existing = await db.get<Row>('shifts', id);
  if (!existing) throw new Error('That shift no longer exists.');
  const row = await db.update<Row>('shifts', id, {
    status,
    published_at: status === 'published' ? (existing.published_at as string | null) ?? new Date().toISOString() : existing.published_at,
    updated_by: actor.source === 'supabase' ? actor.id : null,
  });
  await history(db, id, actor, status, existing, row);
  return { before: shiftFromRow(existing), after: shiftFromRow(row) };
}

/** Moves a shift to another person (or to open), keeping the record of who had it. */
export async function reassignShift(db: Db, id: string, employeeId: string | null, actor: Staff, reason = 'reassigned'): Promise<{ before: Shift; after: Shift }> {
  const existing = await db.get<Row>('shifts', id);
  if (!existing) throw new Error('That shift no longer exists.');
  const row = await db.update<Row>('shifts', id, { employee_id: employeeId, updated_by: actor.source === 'supabase' ? actor.id : null });
  await history(db, id, actor, reason, existing, row);
  return { before: shiftFromRow(existing), after: shiftFromRow(row) };
}

/** Publishes every draft in a window at a location. Returns the shifts that went out, by employee. */
export async function publishWeek(db: Db, locationId: string, from: string, to: string, actor: Staff): Promise<Shift[]> {
  const drafts = await listShifts(db, { from, to, locationId, includeDrafts: true });
  const published: Shift[] = [];
  for (const shift of drafts) {
    if (shift.status !== 'draft') continue;
    const { after } = await setShiftStatus(db, shift.id, 'published', actor);
    published.push(after);
  }
  return published;
}

/** Copies every non-cancelled shift from one week to the next, as drafts. */
export async function copyWeek(db: Db, locationId: string, weekStart: string, timezone: string, actor: Staff, targetWeekStart: string = addDays(weekStart, 7)): Promise<number> {
  const from = zonedInstant(weekStart, 0, timezone);
  const to = zonedInstant(addDays(weekStart, 7), 0, timezone);
  const source = await listShifts(db, { from, to, locationId, includeDrafts: true });
  const offset = 7 * 86_400_000 * ((Date.parse(`${targetWeekStart}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / (7 * 86_400_000));
  const groupId = crypto.randomUUID();
  let copied = 0;
  for (const shift of source) {
    const startsAt = new Date(Date.parse(shift.startsAt) + offset).toISOString();
    const endsAt = new Date(Date.parse(shift.endsAt) + offset).toISOString();
    const row = await db.insert<Row>('shifts', {
      location_id: shift.locationId,
      employee_id: shift.employeeId,
      position_id: shift.positionId,
      starts_at: startsAt,
      ends_at: endsAt,
      event_id: null,
      note: shift.note,
      status: 'draft',
      published_at: null,
      repeat_group_id: groupId,
      break_minutes: 0,
      attendance_status: 'not_tracked',
      created_by: actor.source === 'supabase' ? actor.id : null,
      created_at: new Date().toISOString(),
    });
    await history(db, String(row.id), actor, `copied from ${zonedDate(shift.startsAt, timezone)}`, null, row);
    copied += 1;
  }
  return copied;
}

/** Repeats a shift weekly for N further weeks, sharing one group id. */
export async function repeatShift(db: Db, input: ShiftInput, weeks: number, timezone: string, actor: Staff): Promise<Shift[]> {
  const groupId = crypto.randomUUID();
  const created: Shift[] = [];
  for (let week = 0; week <= weeks; week += 1) {
    created.push(await createShift(db, { ...input, date: addDays(input.date, week * 7) }, timezone, actor, groupId));
  }
  return created;
}

/* --------------------------------------------------------------- attendance */

export async function clockIn(db: Db, shift: Shift, at: Date): Promise<Shift> {
  const lateAfter = Date.parse(shift.startsAt) + 5 * 60_000;
  const row = await db.update<Row>('shifts', shift.id, {
    clock_in_at: at.toISOString(),
    attendance_status: at.getTime() > lateAfter ? 'late' : 'on_time',
  });
  return shiftFromRow(row);
}

export async function clockOut(db: Db, shift: Shift, at: Date): Promise<Shift> {
  const earlyBefore = Date.parse(shift.endsAt) - 15 * 60_000;
  const status: AttendanceStatus = shift.attendanceStatus === 'late' ? 'late' : at.getTime() < earlyBefore ? 'left_early' : shift.attendanceStatus === 'not_tracked' ? 'on_time' : shift.attendanceStatus;
  const row = await db.update<Row>('shifts', shift.id, { clock_out_at: at.toISOString(), attendance_status: status });
  return shiftFromRow(row);
}

export async function correctAttendance(
  db: Db,
  id: string,
  input: { clockInAt: string | null; clockOutAt: string | null; breakMinutes: number; attendanceStatus: AttendanceStatus; note: string | null },
  actor: Staff,
): Promise<{ before: Shift; after: Shift }> {
  const existing = await db.get<Row>('shifts', id);
  if (!existing) throw new Error('That shift no longer exists.');
  const row = await db.update<Row>('shifts', id, {
    clock_in_at: input.clockInAt,
    clock_out_at: input.clockOutAt,
    break_minutes: input.breakMinutes,
    attendance_status: input.attendanceStatus,
    attendance_note: input.note,
    corrected_by: actor.source === 'supabase' ? actor.id : null,
    corrected_at: new Date().toISOString(),
  });
  await history(db, id, actor, 'attendance corrected', existing, row);
  return { before: shiftFromRow(existing), after: shiftFromRow(row) };
}

export interface ShiftHistoryEntry {
  id: string;
  changedAt: string;
  reason: string;
  before: Shift | null;
  after: Shift | null;
}

export async function shiftHistory(db: Db, shiftId: string): Promise<ShiftHistoryEntry[]> {
  const rows = await db.list<Row>('shift_history', { where: { shift_id: shiftId }, orderBy: 'changed_at', desc: true });
  return rows.map((row) => ({
    id: String(row.id),
    changedAt: String(row.changed_at),
    reason: String(row.reason ?? ''),
    before: row.before ? shiftFromRow(row.before as Row) : null,
    after: row.after ? shiftFromRow(row.after as Row) : null,
  }));
}
