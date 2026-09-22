import 'server-only';

import type { EmployeeDetail, EmployeeStatus, EmployeeSummary, EmploymentType, Position } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Role } from '@/server/permissions';
import { signedEmployeeFileUrl } from './storage';

/**
 * The employee record: one person, their positions, their locations.
 *
 * Readers go through `listEmployees` / `getEmployee`, which join the two
 * small link tables in memory (there are dozens of employees, not
 * thousands). Writers are the functions further down; every one is called
 * from a server action that has already checked the capability.
 */

function displayName(row: Row): string {
  return String(row.preferred_name || row.first_name || '').trim() || String(row.email ?? '');
}

export function employeeFromRow(row: Row, positions: Row[], locations: Row[], accessRole: Role | null): EmployeeSummary {
  const mine = positions.filter((entry) => entry.employee_id === row.id);
  const primary = mine.find((entry) => entry.is_primary) ?? mine[0] ?? null;
  return {
    id: String(row.id),
    userId: (row.user_id as string | null) ?? null,
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    preferredName: (row.preferred_name as string | null) ?? null,
    displayName: displayName(row),
    fullName: `${String(row.first_name ?? '')} ${String(row.last_name ?? '')}`.trim(),
    email: String(row.email ?? ''),
    phone: (row.phone as string | null) ?? null,
    status: (row.status as EmployeeStatus) ?? 'invited',
    employmentType: (row.employment_type as EmploymentType) ?? 'part_time',
    primaryLocationId: (row.primary_location_id as string | null) ?? null,
    positionIds: mine.map((entry) => String(entry.position_id)),
    primaryPositionId: primary ? String(primary.position_id) : null,
    locationIds: locations.filter((entry) => entry.employee_id === row.id).map((entry) => String(entry.location_id)),
    photoPath: (row.photo_path as string | null) ?? null,
    photoUrl: null,
    hireDate: (row.hire_date as string | null) ?? null,
    startDate: (row.start_date as string | null) ?? null,
    managerEmployeeId: (row.manager_employee_id as string | null) ?? null,
    onboardingCompletedAt: (row.onboarding_completed_at as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
    accessRole,
  };
}

function detailFromRow(row: Row, summary: EmployeeSummary): EmployeeDetail {
  return {
    ...summary,
    emergencyContactName: (row.emergency_contact_name as string | null) ?? null,
    emergencyContactPhone: (row.emergency_contact_phone as string | null) ?? null,
    emergencyContactRelationship: (row.emergency_contact_relationship as string | null) ?? null,
    shirtSize: (row.shirt_size as string | null) ?? null,
    preferredLanguage: row.preferred_language === 'es' ? 'es' : 'en',
    birthdayMonth: (row.birthday_month as number | null) ?? null,
    birthdayDay: (row.birthday_day as number | null) ?? null,
    notificationEmail: row.notification_email !== false,
    firstShiftConfirmedAt: (row.first_shift_confirmed_at as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
  };
}

async function accessRoles(db: Db, userIds: string[]): Promise<Map<string, Role>> {
  if (userIds.length === 0) return new Map();
  try {
    const rows = await db.list<Row>('profiles', { whereIn: { user_id: userIds } });
    return new Map(rows.map((row) => [String(row.user_id), row.role as Role]));
  } catch {
    return new Map();
  }
}

export interface EmployeeFilter {
  includeInactive?: boolean;
  includeArchived?: boolean;
  locationId?: string | null;
  positionId?: string | null;
  query?: string;
}

export async function listEmployees(db: Db, filter: EmployeeFilter = {}): Promise<EmployeeSummary[]> {
  const [rows, positions, locations] = await Promise.all([
    db.list<Row>('employees', { orderBy: 'first_name' }),
    db.list<Row>('employee_positions'),
    db.list<Row>('employee_locations'),
  ]);
  const roles = await accessRoles(db, rows.map((row) => row.user_id as string | null).filter((id): id is string => Boolean(id)));
  const needle = filter.query?.trim().toLowerCase() ?? '';
  return rows
    .map((row) => employeeFromRow(row, positions, locations, row.user_id ? (roles.get(String(row.user_id)) ?? null) : null))
    .filter((employee) => filter.includeArchived || employee.archivedAt === null)
    .filter((employee) => filter.includeInactive || employee.status !== 'inactive')
    .filter((employee) => !filter.locationId || employee.primaryLocationId === filter.locationId || employee.locationIds.includes(filter.locationId))
    .filter((employee) => !filter.positionId || employee.positionIds.includes(filter.positionId))
    .filter((employee) => {
      if (!needle) return true;
      const haystack = [employee.fullName, employee.preferredName ?? '', employee.email, employee.phone ?? '', ...employee.positionIds].join(' ').toLowerCase();
      return haystack.includes(needle);
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Who to tell when something needs a manager.
 *
 * Resolved from the account tier on the employee row rather than from the
 * position, so an Owner or Manager sign-in is reached whether or not anyone
 * remembered to give them the `manager` position.
 */
export async function managersToNotify(db: Db, locationId: string | null = null): Promise<EmployeeSummary[]> {
  const everyone = await listEmployees(db, locationId ? { locationId } : {});
  const managers = everyone.filter((employee) => employee.accessRole === 'owner' || employee.accessRole === 'admin' || employee.positionIds.includes('manager'));
  // A location with no manager of its own still needs someone to hear it.
  return managers.length > 0 || !locationId ? managers : managersToNotify(db, null);
}

export async function employeeMap(db: Db): Promise<Map<string, EmployeeSummary>> {
  const list = await listEmployees(db, { includeInactive: true, includeArchived: true });
  return new Map(list.map((employee) => [employee.id, employee]));
}

export async function getEmployee(db: Db, id: string, options: { withPhoto?: boolean } = {}): Promise<EmployeeDetail | null> {
  const row = await db.get<Row>('employees', id);
  if (!row) return null;
  const [positions, locations] = await Promise.all([
    db.list<Row>('employee_positions', { where: { employee_id: id } }),
    db.list<Row>('employee_locations', { where: { employee_id: id } }),
  ]);
  const roles = row.user_id ? await accessRoles(db, [String(row.user_id)]) : new Map<string, Role>();
  const summary = employeeFromRow(row, positions, locations, row.user_id ? (roles.get(String(row.user_id)) ?? null) : null);
  if (options.withPhoto) summary.photoUrl = await signedEmployeeFileUrl(summary.photoPath);
  return detailFromRow(row, summary);
}

export async function findEmployeeByUser(db: Db, userId: string): Promise<EmployeeSummary | null> {
  try {
    const rows = await db.list<Row>('employees', { where: { user_id: userId }, limit: 1 });
    const row = rows[0];
    if (!row) return null;
    const [positions, locations] = await Promise.all([
      db.list<Row>('employee_positions', { where: { employee_id: String(row.id) } }),
      db.list<Row>('employee_locations', { where: { employee_id: String(row.id) } }),
    ]);
    return employeeFromRow(row, positions, locations, null);
  } catch {
    return null;
  }
}

export async function findEmployeeByEmail(db: Db, email: string): Promise<Row | null> {
  const rows = await db.list<Row>('employees');
  const needle = email.trim().toLowerCase();
  return rows.find((row) => String(row.email ?? '').toLowerCase() === needle && !row.archived_at) ?? null;
}

export async function listPositions(db: Db): Promise<Position[]> {
  const rows = await db.list<Row>('positions', { orderBy: 'sort' });
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    department: String(row.department ?? 'other'),
    sort: Number(row.sort ?? 0),
    active: row.active !== false,
  }));
}

export async function positionMap(db: Db): Promise<Map<string, Position>> {
  return new Map((await listPositions(db)).map((position) => [position.id, position]));
}

/* ------------------------------------------------------------------ writes */

export interface EmployeeInput {
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string;
  phone: string | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  primaryLocationId: string | null;
  positionIds: string[];
  primaryPositionId: string | null;
  locationIds: string[];
  hireDate: string | null;
  startDate: string | null;
  managerEmployeeId: string | null;
}

export async function createEmployee(db: Db, input: EmployeeInput, createdBy: string | null): Promise<Row> {
  const row = await db.insert<Row>('employees', {
    first_name: input.firstName,
    last_name: input.lastName,
    preferred_name: input.preferredName,
    email: input.email.trim().toLowerCase(),
    phone: input.phone,
    status: input.status,
    employment_type: input.employmentType,
    primary_location_id: input.primaryLocationId,
    hire_date: input.hireDate,
    start_date: input.startDate,
    manager_employee_id: input.managerEmployeeId,
    preferred_language: 'en',
    notification_email: true,
    created_by: createdBy,
    created_at: new Date().toISOString(),
  });
  await setEmployeePositions(db, String(row.id), input.positionIds, input.primaryPositionId);
  await setEmployeeLocations(db, String(row.id), input.locationIds, input.primaryLocationId);
  return row;
}

export async function updateEmployeeManagement(db: Db, id: string, input: EmployeeInput): Promise<Row> {
  const row = await db.update<Row>('employees', id, {
    first_name: input.firstName,
    last_name: input.lastName,
    preferred_name: input.preferredName,
    email: input.email.trim().toLowerCase(),
    phone: input.phone,
    status: input.status,
    employment_type: input.employmentType,
    primary_location_id: input.primaryLocationId,
    hire_date: input.hireDate,
    start_date: input.startDate,
    manager_employee_id: input.managerEmployeeId,
    end_date: input.status === 'inactive' ? new Date().toISOString().slice(0, 10) : null,
  });
  await setEmployeePositions(db, id, input.positionIds, input.primaryPositionId);
  await setEmployeeLocations(db, id, input.locationIds, input.primaryLocationId);
  return row;
}

export async function setEmployeePositions(db: Db, employeeId: string, positionIds: string[], primary: string | null): Promise<void> {
  const existing = await db.list<Row>('employee_positions', { where: { employee_id: employeeId } });
  const wanted = new Set(positionIds);
  for (const row of existing) {
    if (!wanted.has(String(row.position_id))) await db.remove('employee_positions', String(row.id));
  }
  for (const positionId of positionIds) {
    const current = existing.find((row) => row.position_id === positionId);
    const isPrimary = positionId === (primary ?? positionIds[0]);
    if (current) {
      if (Boolean(current.is_primary) !== isPrimary) await db.update('employee_positions', String(current.id), { is_primary: isPrimary });
    } else {
      await db.insert('employee_positions', { employee_id: employeeId, position_id: positionId, is_primary: isPrimary, since: new Date().toISOString().slice(0, 10) });
    }
  }
}

export async function setEmployeeLocations(db: Db, employeeId: string, locationIds: string[], primary: string | null): Promise<void> {
  const wanted = new Set(locationIds);
  if (primary) wanted.add(primary);
  const existing = await db.list<Row>('employee_locations', { where: { employee_id: employeeId } });
  for (const row of existing) {
    if (!wanted.has(String(row.location_id))) await db.remove('employee_locations', String(row.id));
  }
  for (const locationId of wanted) {
    if (!existing.some((row) => row.location_id === locationId)) {
      await db.insert('employee_locations', { employee_id: employeeId, location_id: locationId });
    }
  }
}

/** The fields an employee may change about themselves. Mirrors the column guard in 0022. */
export interface SelfProfileInput {
  preferredName: string | null;
  phone: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  shirtSize: string | null;
  preferredLanguage: 'en' | 'es';
  birthdayMonth: number | null;
  birthdayDay: number | null;
  notificationEmail: boolean;
}

export async function updateOwnProfile(db: Db, employeeId: string, input: SelfProfileInput): Promise<Row> {
  return db.update<Row>('employees', employeeId, {
    preferred_name: input.preferredName,
    phone: input.phone,
    emergency_contact_name: input.emergencyContactName,
    emergency_contact_phone: input.emergencyContactPhone,
    emergency_contact_relationship: input.emergencyContactRelationship,
    shirt_size: input.shirtSize,
    preferred_language: input.preferredLanguage,
    birthday_month: input.birthdayMonth,
    birthday_day: input.birthdayDay,
    notification_email: input.notificationEmail,
  });
}

/** True when the profile has what onboarding calls "personal details". */
export function hasPersonalDetails(employee: EmployeeDetail): boolean {
  return Boolean(employee.firstName && employee.phone && employee.shirtSize);
}

export function hasEmergencyContact(employee: EmployeeDetail): boolean {
  return Boolean(employee.emergencyContactName && employee.emergencyContactPhone);
}
