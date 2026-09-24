import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Contractor, EmployeeSummary, LocationSummary, OpsRole } from '@/content/staff-types';
import { DEFAULT_LOCATION } from '@/content/locations';
import { getStaff, type Staff } from '@/server/auth';
import { opsReadDb } from './db';
import { findContractorByUser } from './contractors';
import { findEmployeeByUser } from './employees';
import { listLocations } from './locations';
import { clampPreview, deriveOpsRole, isPreviewableRole, isManagerRole, opsCan, OPS_DENIED_MESSAGE, type OpsCapability } from './permissions';

/**
 * Who is using the staff app, resolved once per request.
 *
 * `staff` is the account (from `src/server/auth.ts`, the same identity the
 * admin uses); `employee` is the person, when the account has an employee
 * row; `opsRole` is what the two together allow. A manager without an
 * employee row is still a manager — they can run the schedule — but has no
 * shift of their own to see, and the home screen says so instead of
 * pretending.
 *
 * `previewing` is the owner's "see it as they see it" tool. It resolves
 * through `clampPreview`, which can only ever move DOWN the authority
 * ladder, so the cookie is not a privilege to forge — at worst you preview
 * yourself as something smaller.
 */
export const PREVIEW_COOKIE = 'casa-aurelia_ops_preview';

export interface StaffContext {
  staff: Staff;
  employee: EmployeeSummary | null;
  /** Set only when the account is a contractor with a sign-in. */
  contractor: Contractor | null;
  /** What this request is allowed to do — after any preview. */
  opsRole: OpsRole;
  /** What the account is actually allowed to do. */
  actualRole: OpsRole;
  /** The role being previewed, when a preview is running. */
  previewing: OpsRole | null;
  isManager: boolean;
  isOwner: boolean;
  /** The locations this person works at, or every active one for a manager. */
  locations: LocationSummary[];
  /** The location the app opens on. */
  location: LocationSummary;
}

async function previewRole(): Promise<OpsRole | null> {
  try {
    const value = (await cookies()).get(PREVIEW_COOKIE)?.value ?? '';
    return isPreviewableRole(value) ? value : null;
  } catch {
    return null;
  }
}

export const getStaffContext = cache(async (): Promise<StaffContext | null> => {
  const staff = await getStaff();
  if (!staff) return null;
  const db = opsReadDb();
  const employee = db ? await findEmployeeByUser(db, staff.id) : null;
  const actualRole = deriveOpsRole({
    role: staff.role,
    active: staff.active,
    hasEmployee: employee !== null,
    employeeActive: employee !== null && employee.status !== 'inactive' && employee.archivedAt === null,
  });
  const wanted = await previewRole();
  const opsRole = clampPreview(actualRole, wanted);
  const previewing = opsRole === actualRole ? null : opsRole;
  const contractor = db && (actualRole === 'contractor' || opsRole === 'contractor') ? await findContractorByUser(db, staff.id) : null;
  const all = db ? await listLocations(db) : [];
  const active = all.filter((location) => location.active);
  const manager = isManagerRole(opsRole);
  const mine = manager
    ? active
    : active.filter((location) => employee?.locationIds.includes(location.id) || employee?.primaryLocationId === location.id);
  const locations = mine.length > 0 ? mine : active.length > 0 ? active : [defaultLocation()];
  const location = locations.find((entry) => entry.id === employee?.primaryLocationId) ?? locations[0]!;
  return { staff, employee, contractor, opsRole, actualRole, previewing, isManager: manager, isOwner: opsRole === 'owner', locations, location };
});

function defaultLocation(): LocationSummary {
  return {
    id: DEFAULT_LOCATION.id,
    slug: DEFAULT_LOCATION.slug,
    name: DEFAULT_LOCATION.name,
    shortName: DEFAULT_LOCATION.shortName,
    timezone: DEFAULT_LOCATION.timezone,
    active: true,
  };
}

export function contextCan(context: StaffContext, capability: OpsCapability): boolean {
  return opsCan({ role: context.opsRole, active: context.staff.active }, capability);
}

/**
 * The guard every staff mutation runs first. Throws so a forgotten `if`
 * cannot fall through to a write; the message is one a person can act on.
 */
export async function requireOps(capability: OpsCapability): Promise<StaffContext> {
  const context = await getStaffContext();
  if (!context) throw new Error('Please sign in again.');
  if (!contextCan(context, capability)) throw new Error(OPS_DENIED_MESSAGE[capability]);
  return context;
}

/**
 * The same guard, but measured against what the account really is rather
 * than what it is previewing. Used only by the preview control itself —
 * otherwise an owner previewing as an employee could not get back out.
 */
export async function requireActualOps(capability: OpsCapability): Promise<StaffContext> {
  const context = await getStaffContext();
  if (!context) throw new Error('Please sign in again.');
  if (!opsCan({ role: context.actualRole, active: context.staff.active }, capability)) throw new Error(OPS_DENIED_MESSAGE[capability]);
  return context;
}

/** Whether this context may act on this employee's private data. */
export function canSeeEmployee(context: StaffContext, employeeId: string): boolean {
  return context.isManager || context.employee?.id === employeeId;
}
