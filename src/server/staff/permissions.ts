import type { OpsRole } from '@/content/staff-types';
import type { Role } from '@/server/permissions';

/**
 * Operational capabilities: what an account may do to people, schedules,
 * training and the rest of the staff system.
 *
 * Kept apart from the content matrix in `src/server/permissions.ts` on
 * purpose. That one answers "may this account change the website"; this one
 * answers "may this account see Carlos's documents". The stored role is the
 * same `profiles.role`; the operational role is derived from it plus whether
 * the account has an employee row:
 *
 *   owner                     → owner
 *   admin                     → manager
 *   staff, or editor with an employee row → employee
 *   contractor                → contractor
 *   anything else             → none
 *
 * The principle the matrix encodes: TRANSPARENCY IS NOT AUTHORITY. Seeing
 * who is on tonight, or what the event needs, is different from being able
 * to change it — so the read and the write are separate capabilities, and
 * the read is the one an employee gets.
 *
 * Pure and dependency-free, and the tests assert every cell.
 */

export type { OpsRole };

export type OpsCapability =
  | 'staff.view_self'
  | 'staff.view_roster'
  | 'staff.view_team'
  | 'staff.manage_team'
  | 'staff.manage_access'
  | 'schedule.view_self'
  | 'schedule.view_team'
  | 'schedule.manage'
  | 'schedule.publish'
  | 'availability.manage_self'
  | 'timeoff.request'
  | 'timeoff.approve'
  | 'coverage.request'
  | 'coverage.approve'
  | 'training.view_self'
  | 'training.manage'
  | 'documents.view_self'
  | 'documents.manage'
  | 'tasks.view_self'
  | 'tasks.manage'
  | 'checklists.complete'
  | 'checklists.manage'
  | 'events.view_brief'
  | 'events.staff'
  | 'events.view_money'
  | 'incidents.report'
  | 'incidents.manage'
  | 'contractors.manage'
  | 'contractors.view_self'
  | 'announcements.manage'
  | 'notes.manage'
  | 'locations.view_all'
  | 'locations.manage'
  | 'system.preview_role';

/**
 * An employee. Everything here is either their own, or the operational
 * context of a night they are working — never anyone else's private record
 * and never a number with a currency sign on it.
 */
const EMPLOYEE: OpsCapability[] = [
  'staff.view_self',
  'staff.view_roster',
  'schedule.view_self',
  'availability.manage_self',
  'timeoff.request',
  'coverage.request',
  'training.view_self',
  'documents.view_self',
  'tasks.view_self',
  'checklists.complete',
  'events.view_brief',
  'incidents.report',
];

const MANAGER: OpsCapability[] = [
  ...EMPLOYEE,
  'staff.view_team',
  'staff.manage_team',
  'schedule.view_team',
  'schedule.manage',
  'schedule.publish',
  'timeoff.approve',
  'coverage.approve',
  'training.manage',
  'documents.manage',
  'tasks.manage',
  'checklists.manage',
  'events.staff',
  'events.view_money',
  'contractors.manage',
  'announcements.manage',
  'incidents.manage',
  'notes.manage',
];

const MATRIX: Record<OpsRole, OpsCapability[]> = {
  owner: [...MANAGER, 'staff.manage_access', 'locations.view_all', 'locations.manage', 'system.preview_role'],
  manager: MANAGER,
  employee: EMPLOYEE,
  // A contractor sees their own bookings and nothing else of the restaurant.
  contractor: ['contractors.view_self'],
  none: [],
};

export interface OpsActor {
  role: OpsRole;
  active?: boolean;
}

export function opsCan(actor: OpsActor, capability: OpsCapability): boolean {
  if (actor.active === false) return false;
  return MATRIX[actor.role]?.includes(capability) ?? false;
}

export function isManagerRole(role: OpsRole): boolean {
  return role === 'owner' || role === 'manager';
}

/** The operational role an account resolves to. */
export function deriveOpsRole(input: { role: Role; active: boolean; hasEmployee: boolean; employeeActive: boolean }): OpsRole {
  if (!input.active) return 'none';
  if (input.role === 'owner') return 'owner';
  if (input.role === 'admin') return 'manager';
  if (input.role === 'contractor') return 'contractor';
  if (input.hasEmployee && input.employeeActive) return 'employee';
  return 'none';
}

/**
 * How much authority a role carries, low to high.
 *
 * Used by the owner's "preview as" tool, which may only ever move DOWN this
 * list. Clamping rather than substituting is what makes the preview safe:
 * an employee who forges the cookie previews as an employee.
 */
const RANK: Record<OpsRole, number> = { none: 0, contractor: 1, employee: 2, manager: 3, owner: 4 };

export function isPreviewableRole(value: string): value is OpsRole {
  return value === 'employee' || value === 'manager' || value === 'contractor';
}

/** The role a preview resolves to: never more than the account actually has. */
export function clampPreview(actual: OpsRole, preview: OpsRole | null): OpsRole {
  if (!preview) return actual;
  return RANK[preview] < RANK[actual] ? preview : actual;
}

/** The message a blocked person sees. Explains, never just refuses. */
export const OPS_DENIED_MESSAGE: Record<OpsCapability, string> = {
  'staff.view_self': 'Your account is not set up as an employee yet. Ask a manager to add you to the team.',
  'staff.view_roster': 'Your account is not set up as an employee yet.',
  'staff.view_team': 'Only a manager can see the team directory.',
  'staff.manage_team': 'Only a manager can add or change employees.',
  'staff.manage_access': 'Only the owner can change what an account is allowed to do.',
  'schedule.view_self': 'Your account is not set up as an employee yet.',
  'schedule.view_team': 'Only a manager can see the whole schedule.',
  'schedule.manage': 'Only a manager can change the schedule.',
  'schedule.publish': 'Only a manager can publish a schedule.',
  'availability.manage_self': 'Availability belongs to the employee. A manager can see it, not change it.',
  'timeoff.request': 'Only an employee can request time off for themselves.',
  'timeoff.approve': 'Only a manager can approve or deny time off — never the person who asked.',
  'coverage.request': 'Only the employee on a shift can offer it up.',
  'coverage.approve': 'Only a manager can approve a shift change.',
  'training.view_self': 'Your account is not set up as an employee yet.',
  'training.manage': 'Only a manager can create training or mark it complete for someone else.',
  'documents.view_self': 'Your account is not set up as an employee yet.',
  'documents.manage': 'Only a manager can see or verify another employee’s documents.',
  'tasks.view_self': 'Your account is not set up as an employee yet.',
  'tasks.manage': 'Only a manager can create or assign tasks.',
  'checklists.complete': 'Your account is not set up as an employee yet.',
  'checklists.manage': 'Only a manager can create checklists.',
  'events.view_brief': 'Your account is not set up as an employee yet.',
  'events.staff': 'Only a manager can staff an event.',
  'events.view_money': 'Ticket sales and payouts are for managers.',
  'incidents.report': 'Your account is not set up as an employee yet.',
  'incidents.manage': 'Only a manager can see or review incidents.',
  'contractors.manage': 'Only a manager can see contractors and bookings.',
  'contractors.view_self': 'That booking is not yours.',
  'announcements.manage': 'Only a manager can post announcements.',
  'notes.manage': 'Only a manager can see manager notes.',
  'locations.view_all': 'Only the owner sees every location at once.',
  'locations.manage': 'Only the owner can add a location.',
  'system.preview_role': 'Only the owner can preview the app as another role.',
};
