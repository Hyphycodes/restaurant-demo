import 'server-only';

import type { ChecklistRun, EventBrief, SchedulePeriodStatus, ShiftRequest, ShiftView, StaffAnnouncement, Task, TrainingAssignment } from '@/content/staff-types';
import type { Db } from '@/lib/db/types';
import { addDays, greetingFor, startOfWeek, zonedDate, zonedInstant, zonedParts } from '@/lib/staff/time';
import { feedFor } from './announcements';
import { briefsFor } from './briefs';
import { listRuns } from './checklists';
import { listShiftRequests } from './coverage';
import { listEventsBetween, type EventSummaryLite } from './events';
import { getSalesSummaries } from '@/server/ticketing/sales';
import { scheduleStatusFor } from './periods';
import { onboardingFor } from './requirements';
import { listShiftViews } from './schedule';
import { contextCan, type StaffContext } from './session';
import { listTasks } from './tasks';
import { listAssignments, outstanding } from './training';



/** One line of "what needs me": a checklist item or a task, the same to a thumb. */
export interface TodayLine {
  key: string;
  kind: 'checklist' | 'task';
  /** For a checklist line: the run it belongs to. */
  runId: string | null;
  id: string;
  label: string;
  detail: string | null;
  done: boolean;
  overdue: boolean;
  requiresPhoto: boolean;
  requiresNote: boolean;
  /** Where tapping the line's title goes, when there is somewhere useful. */
  href: string | null;
}

export interface TonightEvent {
  id: string;
  title: string;
  startsAt: string;
  doorsAt: string | null;
  /** How many people to expect. A crowd size, never a number of dollars. */
  crowd: number | null;
  crowdLabel: string | null;
  brief: EventBrief | null;
  /** The position this person is working that night, when they are on it. */
  myRole: string | null;
  /** Managers only: what the night has taken. Null for everyone else. */
  money: { grossCents: number; ticketsSold: number; checkedIn: number; capacity: number | null } | null;
}

export interface StaffHome {
  greeting: string;
  today: string;
  timezone: string;
  /** Today's shifts, earliest first. Empty means the person is off. */
  todayShifts: ShiftView[];
  /** The shift happening right now, if there is one. */
  onNow: ShiftView | null;
  nextShift: ShiftView | null;
  upcoming: ShiftView[];
  /** Coworkers on today at the same location: a name and a time, nothing more. */
  withYou: { name: string; position: string; startsAt: string; endsAt: string }[];
  tonight: TonightEvent[];
  lines: TodayLine[];
  checklists: ChecklistRun[];
  announcements: StaffAnnouncement[];
  training: TrainingAssignment[];
  openShifts: ShiftView[];
  coverage: ShiftRequest[];
  onboarding: { total: number; complete: number; stage: 'not_started' | 'in_progress' | 'ready' } | null;
  /** Whether next week is out yet, so the screen can say which. */
  nextWeek: { weekStart: string; status: SchedulePeriodStatus; shifts: number };
  managerToday: { scheduled: number; openShifts: number; events: number; unpublished: number; needsDecision: number } | null;
}

export async function staffHome(db: Db, context: StaffContext, now = new Date()): Promise<StaffHome> {
  const timezone = context.location.timezone;
  const today = zonedDate(now, timezone);
  const greeting = greetingFor(zonedParts(now, timezone).hour);
  const employee = context.employee;
  const dayStart = zonedInstant(today, 0, timezone);
  const dayEnd = zonedInstant(addDays(today, 1), 0, timezone);
  const horizon = zonedInstant(addDays(today, 21), 0, timezone);
  const nextWeekStart = addDays(startOfWeek(today), 7);
  const seesMoney = contextCan(context, 'events.view_money');
  const seesRoster = contextCan(context, 'staff.view_roster');

  const [myShifts, events, tasks, announcements, training, runs, openShifts, coverage, onboarding, roster, nextWeekStatus, nextWeekShifts, managerDay] = await Promise.all([
    employee ? listShiftViews(db, { from: dayStart, to: horizon, employeeId: employee.id }) : Promise.resolve([] as ShiftView[]),
    listEventsBetween(db, dayStart, dayEnd, context.location.id),
    employee ? listTasks(db, { assignedTo: employee.id, open: true }, now) : Promise.resolve([] as Task[]),
    employee ? feedFor(db, employee, now) : Promise.resolve([] as StaffAnnouncement[]),
    employee ? listAssignments(db, { employeeId: employee.id, today }) : Promise.resolve([] as TrainingAssignment[]),
    employee || context.isManager ? listRuns(db, { onDate: today, locationId: context.location.id }) : Promise.resolve([] as ChecklistRun[]),
    employee ? listShiftViews(db, { from: dayStart, to: horizon, locationId: context.location.id, openOnly: true }) : Promise.resolve([] as ShiftView[]),
    employee ? listShiftRequests(db, { status: ['open', 'claimed'] }) : Promise.resolve([] as ShiftRequest[]),
    employee && !employee.onboardingCompletedAt ? onboardingFor(db, employee.id, { today }) : Promise.resolve(null),
    seesRoster ? listShiftViews(db, { from: dayStart, to: dayEnd, locationId: context.location.id }) : Promise.resolve([] as ShiftView[]),
    scheduleStatusFor(db, context.location.id, [nextWeekStart]),
    context.isManager ? listShiftViews(db, { from: zonedInstant(nextWeekStart, 0, timezone), to: zonedInstant(addDays(nextWeekStart, 7), 0, timezone), locationId: context.location.id, includeDrafts: true }) : Promise.resolve([] as ShiftView[]),
    context.isManager
      ? listShiftViews(db, { from: dayStart, to: dayEnd, locationId: context.location.id, includeDrafts: true })
      : Promise.resolve([] as ShiftView[]),
  ]);

  const briefs = await briefsFor(db, events.map((event) => event.id));
  // Sales are read once and then shared out. An employee's copy carries the
  // crowd size and nothing else; the money object is null for them.
  const sales = events.length > 0 ? await getSalesSummaries(events.map((event) => event.id)) : new Map();

  const todayShifts = myShifts.filter((shift) => zonedDate(shift.startsAt, timezone) === today || (Date.parse(shift.startsAt) <= now.getTime() && Date.parse(shift.endsAt) > now.getTime()));
  const later = myShifts.filter((shift) => !todayShifts.includes(shift));
  const myEventIds = new Set(myShifts.map((shift) => shift.eventId).filter(Boolean));
  const onNow = todayShifts.find((shift) => Date.parse(shift.startsAt) <= now.getTime() && Date.parse(shift.endsAt) > now.getTime()) ?? null;

  const tonight: TonightEvent[] = events.map((event) => tonightEvent(event, briefs.get(event.id) ?? null, sales.get(event.id) ?? null, myShifts, myEventIds, seesMoney));

  return {
    greeting,
    today,
    timezone,
    todayShifts,
    onNow,
    nextShift: todayShifts.find((shift) => Date.parse(shift.endsAt) > now.getTime()) ?? later[0] ?? null,
    upcoming: later.slice(0, 5),
    withYou: seesRoster
      ? roster
          .filter((shift) => shift.employeeId && shift.employeeId !== employee?.id && shift.employeeName)
          .map((shift) => ({ name: shift.employeeName!, position: shift.positionName, startsAt: shift.startsAt, endsAt: shift.endsAt }))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      : [],
    tonight,
    lines: todayLines(runs, tasks, employee?.id ?? null, context, now),
    checklists: myRuns(runs, employee?.id ?? null, context),
    announcements: announcements.filter((entry) => (entry.requiresAck ? !entry.acknowledgedAt : !entry.readAt)).slice(0, 3),
    training: outstanding(training).slice(0, 3),
    openShifts: openShifts.filter((shift) => employee?.positionIds.includes(shift.positionId) ?? false).slice(0, 3),
    coverage: coverage.filter((request) => request.requestedBy !== employee?.id && request.status === 'open' && (employee?.positionIds.includes(request.shift.positionId) ?? false)).slice(0, 3),
    onboarding: onboarding ? { total: onboarding.total, complete: onboarding.complete, stage: onboarding.stage } : null,
    nextWeek: {
      weekStart: nextWeekStart,
      status: nextWeekStatus.get(nextWeekStart) ?? 'draft',
      shifts: myShifts.filter((shift) => startOfWeek(zonedDate(shift.startsAt, timezone)) === nextWeekStart).length,
    },
    managerToday: context.isManager
      ? {
          scheduled: managerDay.filter((shift) => shift.employeeId && shift.status === 'published').length,
          openShifts: managerDay.filter((shift) => !shift.employeeId && shift.status === 'published').length,
          events: events.length,
          unpublished: nextWeekShifts.filter((shift) => shift.status === 'draft').length,
          needsDecision: coverage.filter((request) => request.status === 'claimed' || request.kind === 'give_up').length,
        }
      : null,
  };
}

function tonightEvent(
  event: EventSummaryLite,
  brief: EventBrief | null,
  sale: { ticketsSold: number; grossCents: number; checkedIn: number; capacity: number | null } | null,
  myShifts: ShiftView[],
  myEventIds: Set<string | null>,
  seesMoney: boolean,
): TonightEvent {
  const crowd = brief?.expectedGuests ?? (sale ? sale.ticketsSold : null);
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    doorsAt: event.doorsAt,
    crowd,
    crowdLabel: crowd === null ? null : brief?.expectedGuests != null ? 'expected' : 'tickets out',
    brief,
    myRole: myEventIds.has(event.id) ? (myShifts.find((shift) => shift.eventId === event.id)?.positionName ?? null) : null,
    money: seesMoney && sale ? { grossCents: sale.grossCents, ticketsSold: sale.ticketsSold, checkedIn: sale.checkedIn, capacity: sale.capacity } : null,
  };
}

/** The runs this person is actually responsible for today. */
function myRuns(runs: ChecklistRun[], employeeId: string | null, context: StaffContext): ChecklistRun[] {
  if (context.isManager) return runs;
  return runs.filter((run) => run.assignedEmployeeId === employeeId || !run.assignedEmployeeId);
}

/**
 * Checklist lines and personal tasks, in one list.
 *
 * "Tasks" as a separate destination is what made the old app feel like
 * software. What a person actually has is a handful of things to do before
 * close, and it does not matter to them which table a line came from.
 */
function todayLines(runs: ChecklistRun[], tasks: Task[], employeeId: string | null, context: StaffContext, now: Date): TodayLine[] {
  const lines: TodayLine[] = [];
  for (const run of myRuns(runs, employeeId, context)) {
    if (run.status === 'verified') continue;
    for (const item of run.items) {
      lines.push({
        key: `checklist:${item.id}`,
        kind: 'checklist',
        runId: run.id,
        id: item.id,
        label: item.label,
        detail: run.title,
        done: Boolean(item.completedAt),
        overdue: false,
        requiresPhoto: item.requiresPhoto,
        requiresNote: item.requiresNote,
        href: `/staff/checklists/${run.id}`,
      });
    }
  }
  for (const task of tasks) {
    lines.push({
      key: `task:${task.id}`,
      kind: 'task',
      runId: null,
      id: task.id,
      label: task.title,
      detail: task.eventTitle ?? (task.dueAt ? (Date.parse(task.dueAt) < now.getTime() ? 'Overdue' : 'Due today') : null),
      done: task.status === 'done',
      overdue: task.overdue,
      requiresPhoto: false,
      requiresNote: false,
      href: `/staff/tasks/${task.id}`,
    });
  }
  // Not done first, overdue above that, and otherwise the order they were given.
  return lines.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return 0;
  });
}
