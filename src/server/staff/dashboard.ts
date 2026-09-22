import 'server-only';

import type { ChecklistRun, ContractorBooking, EmployeeSummary, LocationSummary, RequirementItem, ShiftRequest, ShiftView, StaffingRole, Task, TimeOffRequest, TrainingAssignment } from '@/content/staff-types';
import type { Db } from '@/lib/db/types';
import { addDays, zonedDate, zonedInstant } from '@/lib/staff/time';
import { getSalesSummaries } from '@/server/ticketing/sales';
import { listRuns } from './checklists';
import { listBookings } from './contractors';
import { listShiftRequests } from './coverage';
import { listEmployees } from './employees';
import { listEventsBetween, type EventSummaryLite } from './events';
import { listIncidents } from './incidents';
import { onboardingFor, requirementOverview } from './requirements';
import { listShiftViews } from './schedule';
import { eventStaffing } from './staffing';
import { listTasks } from './tasks';
import { listTimeOff } from './timeoff';
import { listAssignments, outstanding } from './training';

/**
 * What needs a manager's attention today, at one location — or, for the
 * owner, across all of them. No vanity metrics: every number here is
 * something a person can act on before service.
 */

export interface LocationDay {
  location: LocationSummary;
  date: string;
  scheduled: ShiftView[];
  openShifts: ShiftView[];
  draftCount: number;
  events: (EventSummaryLite & { ticketsSold: number | null; staffing: { role: StaffingRole; name: string }[]; gaps: StaffingRole[] })[];
  callOffs: ShiftRequest[];
  overdueTasks: Task[];
  openTasks: number;
  checklists: ChecklistRun[];
  scheduleIssues: ShiftView[];
  incidentsOpen: number;
}

export interface ManagerDashboard {
  today: string;
  days: LocationDay[];
  employees: EmployeeSummary[];
  pendingTimeOff: TimeOffRequest[];
  coverage: ShiftRequest[];
  trainingOverdue: TrainingAssignment[];
  trainingOutstanding: number;
  documentsExpiring: RequirementItem[];
  documentsExpired: RequirementItem[];
  documentsSubmitted: RequirementItem[];
  onboarding: { employee: EmployeeSummary; complete: number; total: number; stage: 'not_started' | 'in_progress' | 'ready' }[];
  contractorsUnpaid: ContractorBooking[];
  contractorsUpcoming: ContractorBooking[];
}

async function locationDay(db: Db, location: LocationSummary, today: string, now: Date): Promise<LocationDay> {
  const from = zonedInstant(today, 0, location.timezone);
  const to = zonedInstant(addDays(today, 1), 0, location.timezone);
  const [shifts, events, tasks, runs, coverage, incidents] = await Promise.all([
    listShiftViews(db, { from, to, locationId: location.id, includeDrafts: true }, { withWarnings: true }),
    listEventsBetween(db, from, to, location.id),
    listTasks(db, { locationId: location.id, open: true }, now),
    listRuns(db, { onDate: today, locationId: location.id }),
    listShiftRequests(db, { status: ['open', 'claimed'] }),
    listIncidents(db, { locationId: location.id, status: 'open' }),
  ]);
  const sales = await getSalesSummaries(events.map((event) => event.id));
  const staffed = await Promise.all(events.map((event) => eventStaffing(db, event.id)));
  const published = shifts.filter((shift) => shift.status === 'published');
  return {
    location,
    date: today,
    scheduled: published.filter((shift) => shift.employeeId),
    openShifts: published.filter((shift) => !shift.employeeId),
    draftCount: shifts.filter((shift) => shift.status === 'draft').length,
    events: events.map((event, index) => ({
      ...event,
      ticketsSold: sales.get(event.id)?.ticketsSold ?? null,
      staffing: (staffed[index]?.assignments ?? []).map((assignment) => ({ role: assignment.role, name: assignment.employeeName })),
      gaps: staffed[index]?.gaps ?? [],
    })),
    callOffs: coverage.filter((request) => zonedDate(request.shift.startsAt, location.timezone) === today && request.shift.locationId === location.id),
    overdueTasks: tasks.filter((task) => task.overdue),
    openTasks: tasks.length,
    checklists: runs,
    scheduleIssues: published.filter((shift) => shift.warnings.length > 0),
    incidentsOpen: incidents.length,
  };
}

export async function managerDashboard(db: Db, locations: LocationSummary[], now = new Date()): Promise<ManagerDashboard> {
  const primary = locations[0]!;
  const today = zonedDate(now, primary.timezone);
  const [days, employees, pendingTimeOff, coverage, training, bookings] = await Promise.all([
    Promise.all(locations.map((location) => locationDay(db, location, today, now))),
    listEmployees(db),
    listTimeOff(db, { status: 'pending' }),
    listShiftRequests(db, { status: ['open', 'claimed'] }),
    listAssignments(db, { today }),
    listBookings(db),
  ]);
  const active = employees.filter((employee) => employee.status === 'active' || employee.status === 'invited');
  const overview = await requirementOverview(db, active.map((employee) => employee.id), today);
  const documentsExpiring: RequirementItem[] = [];
  const documentsExpired: RequirementItem[] = [];
  const documentsSubmitted: RequirementItem[] = [];
  for (const entry of overview.values()) {
    documentsExpiring.push(...entry.expiring);
    documentsExpired.push(...entry.expired);
    documentsSubmitted.push(...entry.submitted);
  }
  const onboarding: ManagerDashboard['onboarding'] = [];
  for (const employee of active) {
    if (employee.onboardingCompletedAt) continue;
    const progress = await onboardingFor(db, employee.id, { today });
    onboarding.push({ employee, complete: progress.complete, total: progress.total, stage: progress.stage });
  }
  const pending = outstanding(training);
  return {
    today,
    days,
    employees: active,
    pendingTimeOff,
    coverage,
    trainingOverdue: pending.filter((assignment) => assignment.overdue),
    trainingOutstanding: pending.length,
    documentsExpiring,
    documentsExpired,
    documentsSubmitted,
    onboarding,
    contractorsUnpaid: bookings.filter((booking) => booking.status !== 'cancelled' && booking.paymentStatus !== 'paid' && booking.agreedCents > 0 && booking.startsAt !== null && booking.startsAt < now.toISOString()),
    contractorsUpcoming: bookings.filter((booking) => booking.status !== 'cancelled' && booking.startsAt !== null && booking.startsAt >= now.toISOString()).slice(0, 8),
  };
}
