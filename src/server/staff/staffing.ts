import 'server-only';

import type { EventAssignment, EventStaffing, StaffingRole } from '@/content/staff-types';
import { STAFFING_ROLE_ORDER } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';
import { getSalesSummaries } from '@/server/ticketing/sales';
import { listBookings } from './contractors';
import { employeeMap } from './employees';
import { getEventLite } from './events';
import { listAssignments as listTraining } from './training';
import { listRequirementsFor } from './requirements';
import { createShift, getShift, reassignShift, setShiftStatus } from './schedule';
import { listTasks } from './tasks';
import { listModules } from './training';
import { zonedDate, zonedMinutes } from '@/lib/staff/time';

/**
 * Staffing an event: who is working it, in what role, and whether they are
 * ready for it. Assigning an employee to an event also creates their shift
 * for the night (published), so the schedule and the staffing board cannot
 * disagree about who is on.
 */


const USUAL_ROLES: StaffingRole[] = ['event_manager', 'door', 'bartender'];

/** Positions the staffing roles map onto for the shift that gets created. */
const ROLE_POSITION: Record<StaffingRole, string> = {
  event_manager: 'manager',
  dj: 'dj',
  door: 'door',
  security: 'security',
  bartender: 'bartender',
  server: 'server',
  host: 'host',
  instructor: 'event_staff',
  photographer: 'content_social',
  other: 'event_staff',
};

/** Training modules whose slug marks readiness for a role. Configurable by slug convention. */
const ROLE_TRAINING_SLUGS: Partial<Record<StaffingRole, string[]>> = {
  door: ['door-scanner'],
  security: ['door-scanner'],
  bartender: ['alcohol-service'],
};

async function readiness(db: Db, employeeId: string, role: StaffingRole): Promise<string[]> {
  const problems: string[] = [];
  const slugs = ROLE_TRAINING_SLUGS[role] ?? [];
  if (slugs.length > 0) {
    const [modules, assignments] = await Promise.all([listModules(db), listTraining(db, { employeeId })]);
    for (const slug of slugs) {
      const lesson = modules.find((entry) => entry.slug === slug);
      if (!lesson) continue;
      const done = assignments.find((entry) => entry.moduleId === lesson.id && entry.status === 'completed' && !entry.outdated);
      if (!done) problems.push(`${lesson.title} not completed`);
    }
  }
  if (role === 'bartender' || role === 'server') {
    const requirements = await listRequirementsFor(db, employeeId);
    const basset = requirements.find((item) => item.type.slug === 'basset');
    if (basset && basset.type.required && basset.state !== 'complete' && basset.state !== 'expiring' && basset.state !== 'waived') problems.push('BASSET missing');
  }
  return problems;
}

export async function listEventAssignments(db: Db, eventId: string): Promise<EventAssignment[]> {
  const [rows, employees] = await Promise.all([db.list<Row>('event_assignments', { where: { event_id: eventId } }), employeeMap(db)]);
  const assignments: EventAssignment[] = [];
  for (const row of rows) {
    if (row.status === 'cancelled') continue;
    const role = row.role as StaffingRole;
    assignments.push({
      id: String(row.id),
      eventId,
      employeeId: String(row.employee_id),
      employeeName: employees.get(String(row.employee_id))?.displayName ?? 'Employee',
      role,
      shiftId: (row.shift_id as string | null) ?? null,
      startsAt: (row.starts_at as string | null) ?? null,
      endsAt: (row.ends_at as string | null) ?? null,
      note: (row.note as string | null) ?? null,
      status: (row.status as EventAssignment['status']) ?? 'planned',
      readiness: await readiness(db, String(row.employee_id), role),
    });
  }
  return assignments.sort((a, b) => STAFFING_ROLE_ORDER.indexOf(a.role) - STAFFING_ROLE_ORDER.indexOf(b.role));
}

export async function eventStaffing(db: Db, eventId: string): Promise<EventStaffing | null> {
  const event = await getEventLite(db, eventId);
  if (!event) return null;
  const [assignments, bookings, tasks, sales] = await Promise.all([listEventAssignments(db, eventId), listBookings(db, { eventId }), listTasks(db, { eventId, open: true }), getSalesSummaries([eventId])]);
  const covered = new Set<StaffingRole>([...assignments.map((assignment) => assignment.role), ...bookings.filter((booking) => booking.status !== 'cancelled').map((booking) => (booking.role === 'dj' ? 'dj' : booking.role === 'security' ? 'security' : booking.role === 'photographer' ? 'photographer' : 'instructor') as StaffingRole)]);
  return {
    event: {
      id: event.id,
      title: event.title,
      slug: event.slug,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      doorsAt: event.doorsAt,
      locationId: event.locationId,
      ticketsSold: sales.get(eventId)?.ticketsSold ?? null,
    },
    assignments,
    bookings: bookings.filter((booking) => booking.status !== 'cancelled'),
    tasks,
    gaps: USUAL_ROLES.filter((role) => !covered.has(role)),
  };
}

export async function listAssignmentsFor(db: Db, employeeId: string, from: string): Promise<{ eventId: string; role: StaffingRole; note: string | null }[]> {
  const rows = await db.list<Row>('event_assignments', { where: { employee_id: employeeId } });
  const events = await Promise.all(rows.map((row) => getEventLite(db, String(row.event_id))));
  return rows
    .map((row, index) => ({ row, event: events[index] }))
    .filter(({ row, event }) => row.status !== 'cancelled' && event && event.startsAt >= from)
    .map(({ row }) => ({ eventId: String(row.event_id), role: row.role as StaffingRole, note: (row.note as string | null) ?? null }));
}

export interface AssignInput {
  eventId: string;
  employeeId: string;
  role: StaffingRole;
  /** Local minutes; null means the event's own start and end. */
  startMinutes: number | null;
  endMinutes: number | null;
  note: string | null;
}

/** Assigns a person to an event and gives them a published shift for it. */
export async function assignToEvent(db: Db, input: AssignInput, timezone: string, actor: Staff, locationId: string): Promise<Row> {
  const event = await getEventLite(db, input.eventId);
  if (!event) throw new Error('That event no longer exists.');
  const existing = await db.list<Row>('event_assignments', { where: { event_id: input.eventId, employee_id: input.employeeId, role: input.role } });
  const current = existing[0];
  const date = zonedDate(event.startsAt, timezone);
  const startMinutes = input.startMinutes ?? zonedMinutes(event.startsAt, timezone);
  const endMinutes = input.endMinutes ?? zonedMinutes(event.endsAt, timezone);
  let shiftId = current ? ((current.shift_id as string | null) ?? null) : null;
  const shiftInput = { locationId: event.locationId ?? locationId, employeeId: input.employeeId, positionId: ROLE_POSITION[input.role], date, startMinutes, endMinutes, eventId: input.eventId, note: input.note, status: 'published' as const };
  if (shiftId && (await getShift(db, shiftId))) {
    const { updateShift } = await import('./schedule');
    await updateShift(db, shiftId, shiftInput, timezone, actor, 'event assignment updated');
  } else {
    shiftId = (await createShift(db, shiftInput, timezone, actor)).id;
  }
  const patch = { shift_id: shiftId, starts_at: null, ends_at: null, note: input.note, status: current ? current.status : 'planned' };
  if (current) return db.update<Row>('event_assignments', String(current.id), patch);
  return db.insert<Row>('event_assignments', { event_id: input.eventId, employee_id: input.employeeId, role: input.role, ...patch, created_by: actor.source === 'supabase' ? actor.id : null, created_at: new Date().toISOString() });
}

export async function removeFromEvent(db: Db, assignmentId: string, actor: Staff): Promise<Row> {
  const row = await db.get<Row>('event_assignments', assignmentId);
  if (!row) throw new Error('That assignment no longer exists.');
  if (row.shift_id) {
    const shift = await getShift(db, String(row.shift_id));
    if (shift) {
      await reassignShift(db, shift.id, null, actor, 'removed from event');
      await setShiftStatus(db, shift.id, 'cancelled', actor);
    }
  }
  return db.update<Row>('event_assignments', assignmentId, { status: 'cancelled' });
}

export async function confirmAssignment(db: Db, assignmentId: string): Promise<Row> {
  return db.update<Row>('event_assignments', assignmentId, { status: 'confirmed' });
}
