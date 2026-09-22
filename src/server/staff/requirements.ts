import 'server-only';

import type { EmployeeDetail, EmployeeSummary, OnboardingProgress, RequirementItem, RequirementKind, RequirementStatus, RequirementType } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import { addDays, daysBetween } from '@/lib/staff/time';
import type { Staff } from '@/server/auth';
import { getEmployee, hasEmergencyContact, hasPersonalDetails } from './employees';
import { signedEmployeeFileUrl } from './storage';

/**
 * Requirements: documents, policies, certifications and the onboarding
 * checklist, all as one shape.
 *
 * A `requirement_types` row is what management asks for. An
 * `employee_requirements` row is where one employee stands on it. The
 * effective state is computed at read time — an upload with an expiry date
 * in the past is "expired" no matter what the stored status says — so the
 * dashboard cannot drift from the truth. `system` requirements (personal
 * details, emergency contact, availability, positions, location, first
 * shift) are evaluated from the profile itself and have no stored row.
 */

const EXPIRING_SOON_DAYS = 30;

export function requirementTypeFromRow(row: Row): RequirementType {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    category: String(row.category ?? 'other'),
    kind: (row.kind as RequirementKind) ?? 'acknowledgement',
    systemKey: (row.system_key as string | null) ?? null,
    trainingModuleId: (row.training_module_id as string | null) ?? null,
    externalUrl: (row.external_url as string | null) ?? null,
    required: row.required !== false,
    onboarding: row.onboarding === true,
    appliesToPositions: (row.applies_to_positions as string[]) ?? [],
    appliesToLocations: (row.applies_to_locations as string[]) ?? [],
    expiresAfterDays: (row.expires_after_days as number | null) ?? null,
    sort: Number(row.sort ?? 0),
    active: row.active !== false && !row.archived_at,
  };
}

export async function listRequirementTypes(db: Db, options: { includeInactive?: boolean } = {}): Promise<RequirementType[]> {
  const rows = await db.list<Row>('requirement_types', { orderBy: 'sort' });
  return rows.map(requirementTypeFromRow).filter((type) => options.includeInactive || type.active);
}

/** Whether a requirement applies to this person at all. */
export function appliesTo(type: RequirementType, employee: EmployeeSummary): boolean {
  const positionOk = type.appliesToPositions.length === 0 || type.appliesToPositions.some((id) => employee.positionIds.includes(id));
  const locationOk =
    type.appliesToLocations.length === 0 ||
    type.appliesToLocations.some((id) => employee.locationIds.includes(id) || employee.primaryLocationId === id);
  return positionOk && locationOk;
}

function effectiveState(status: RequirementStatus, expiresOn: string | null, today: string): RequirementItem['state'] {
  if (status === 'waived') return 'waived';
  if (status === 'complete') {
    if (expiresOn && expiresOn < today) return 'expired';
    if (expiresOn && daysBetween(today, expiresOn) <= EXPIRING_SOON_DAYS) return 'expiring';
    return 'complete';
  }
  if (status === 'expired') return 'expired';
  if (status === 'submitted') return 'submitted';
  return 'missing';
}

function systemState(type: RequirementType, employee: EmployeeDetail, extras: SystemFacts): RequirementItem['state'] {
  switch (type.systemKey) {
    case 'personal_details':
      return hasPersonalDetails(employee) ? 'complete' : 'missing';
    case 'emergency_contact':
      return hasEmergencyContact(employee) ? 'complete' : 'missing';
    case 'availability':
      return extras.hasAvailability ? 'complete' : 'missing';
    case 'positions':
      return employee.positionIds.length > 0 ? 'complete' : 'missing';
    case 'location':
      return employee.primaryLocationId || employee.locationIds.length > 0 ? 'complete' : 'missing';
    case 'first_shift':
      return employee.firstShiftConfirmedAt ? 'complete' : 'missing';
    default:
      return 'missing';
  }
}

interface SystemFacts {
  hasAvailability: boolean;
  trainingComplete: Set<string>;
}

async function systemFacts(db: Db, employeeId: string): Promise<SystemFacts> {
  const [rules, assignments] = await Promise.all([
    db.list<Row>('availability_rules', { where: { employee_id: employeeId } }),
    db.list<Row>('training_assignments', { where: { employee_id: employeeId, status: 'completed' } }),
  ]);
  return { hasAvailability: rules.length > 0, trainingComplete: new Set(assignments.map((row) => String(row.module_id))) };
}

function itemFromRow(row: Row | undefined, type: RequirementType, employeeId: string, state: RequirementItem['state']): RequirementItem {
  return {
    id: row ? String(row.id) : null,
    type,
    employeeId,
    status: (row?.status as RequirementStatus) ?? 'missing',
    state,
    filePath: (row?.file_path as string | null) ?? null,
    fileName: (row?.file_name as string | null) ?? null,
    fileUrl: null,
    credentialNumber: (row?.credential_number as string | null) ?? null,
    issuedOn: (row?.issued_on as string | null) ?? null,
    expiresOn: (row?.expires_on as string | null) ?? null,
    acknowledgedAt: (row?.acknowledged_at as string | null) ?? null,
    submittedAt: (row?.submitted_at as string | null) ?? null,
    verifiedAt: (row?.verified_at as string | null) ?? null,
    note: (row?.note as string | null) ?? null,
  };
}

/** Every requirement that applies to one employee, with its state. */
export async function listRequirementsFor(db: Db, employeeId: string, options: { withFileUrls?: boolean; today?: string } = {}): Promise<RequirementItem[]> {
  const employee = await getEmployee(db, employeeId);
  if (!employee) return [];
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const [types, rows, facts] = await Promise.all([listRequirementTypes(db), db.list<Row>('employee_requirements', { where: { employee_id: employeeId } }), systemFacts(db, employeeId)]);
  const items: RequirementItem[] = [];
  for (const type of types) {
    if (!appliesTo(type, employee)) continue;
    const row = rows.find((entry) => entry.requirement_type_id === type.id);
    let state: RequirementItem['state'];
    if (type.kind === 'system') state = systemState(type, employee, facts);
    else if (type.kind === 'training_module' && type.trainingModuleId) state = facts.trainingComplete.has(type.trainingModuleId) ? 'complete' : 'missing';
    else state = effectiveState((row?.status as RequirementStatus) ?? 'missing', (row?.expires_on as string | null) ?? null, today);
    const item = itemFromRow(row, type, employeeId, state);
    if (options.withFileUrls) item.fileUrl = await signedEmployeeFileUrl(item.filePath);
    items.push(item);
  }
  return items;
}

export async function onboardingFor(db: Db, employeeId: string, options: { today?: string } = {}): Promise<OnboardingProgress> {
  const all = await listRequirementsFor(db, employeeId, options);
  const items = all.filter((item) => item.type.onboarding && item.type.required);
  const complete = items.filter((item) => item.state === 'complete' || item.state === 'expiring' || item.state === 'waived').length;
  return {
    employeeId,
    total: items.length,
    complete,
    items,
    stage: complete === 0 ? 'not_started' : complete >= items.length ? 'ready' : 'in_progress',
  };
}

/** What a manager sees across the team: who is missing what, what is expiring. */
export interface RequirementOverview {
  employeeId: string;
  missing: RequirementItem[];
  expiring: RequirementItem[];
  expired: RequirementItem[];
  submitted: RequirementItem[];
}

export async function requirementOverview(db: Db, employeeIds: string[], today?: string): Promise<Map<string, RequirementOverview>> {
  const result = new Map<string, RequirementOverview>();
  for (const employeeId of employeeIds) {
    const items = await listRequirementsFor(db, employeeId, { today });
    result.set(employeeId, {
      employeeId,
      missing: items.filter((item) => item.state === 'missing' && item.type.required),
      expiring: items.filter((item) => item.state === 'expiring'),
      expired: items.filter((item) => item.state === 'expired'),
      submitted: items.filter((item) => item.state === 'submitted'),
    });
  }
  return result;
}

/* ------------------------------------------------------------------ writes */

async function ensureRow(db: Db, employeeId: string, typeId: string): Promise<Row> {
  const existing = await db.list<Row>('employee_requirements', { where: { employee_id: employeeId, requirement_type_id: typeId } });
  const row = existing[0];
  if (row) return row;
  return db.insert<Row>('employee_requirements', { employee_id: employeeId, requirement_type_id: typeId, status: 'missing', created_at: new Date().toISOString() });
}

/** Creates the empty rows a new employee needs, so the checklist shows every line from day one. */
export async function provisionRequirements(db: Db, employee: EmployeeSummary): Promise<void> {
  const types = await listRequirementTypes(db);
  for (const type of types) {
    if (type.kind === 'system' || type.kind === 'training_module') continue;
    if (!appliesTo(type, employee)) continue;
    await ensureRow(db, employee.id, type.id);
  }
}

export async function acknowledgeRequirement(db: Db, employeeId: string, typeId: string): Promise<void> {
  const row = await ensureRow(db, employeeId, typeId);
  const type = requirementTypeFromRow((await db.get<Row>('requirement_types', typeId))!);
  if (type.kind !== 'acknowledgement' && type.kind !== 'link') throw new Error('This one needs a document or a manager, not an acknowledgement.');
  const now = new Date().toISOString();
  await db.update('employee_requirements', String(row.id), {
    status: 'complete',
    acknowledged_at: now,
    submitted_at: now,
    expires_on: type.expiresAfterDays ? addDays(now.slice(0, 10), type.expiresAfterDays) : null,
  });
}

export async function submitRequirementFile(
  db: Db,
  employeeId: string,
  typeId: string,
  input: { filePath: string | null; fileName: string | null; credentialNumber: string | null; issuedOn: string | null; expiresOn: string | null },
): Promise<void> {
  const row = await ensureRow(db, employeeId, typeId);
  const type = requirementTypeFromRow((await db.get<Row>('requirement_types', typeId))!);
  const expiresOn = input.expiresOn ?? (input.issuedOn && type.expiresAfterDays ? addDays(input.issuedOn, type.expiresAfterDays) : null);
  await db.update('employee_requirements', String(row.id), {
    status: 'submitted',
    file_path: input.filePath ?? row.file_path ?? null,
    file_name: input.fileName ?? row.file_name ?? null,
    credential_number: input.credentialNumber,
    issued_on: input.issuedOn,
    expires_on: expiresOn,
    submitted_at: new Date().toISOString(),
  });
}

export async function verifyRequirement(db: Db, employeeId: string, typeId: string, actor: Staff, input: { status: 'complete' | 'waived' | 'missing'; note: string | null; expiresOn?: string | null }): Promise<{ before: Row; after: Row }> {
  const row = await ensureRow(db, employeeId, typeId);
  const now = new Date().toISOString();
  const after = await db.update<Row>('employee_requirements', String(row.id), {
    status: input.status,
    note: input.note,
    expires_on: input.expiresOn === undefined ? row.expires_on : input.expiresOn,
    verified_by: input.status === 'missing' ? null : actor.source === 'supabase' ? actor.id : null,
    verified_at: input.status === 'missing' ? null : now,
  });
  return { before: row, after };
}

export interface RequirementTypeInput {
  slug: string;
  title: string;
  description: string | null;
  category: string;
  kind: RequirementKind;
  externalUrl: string | null;
  trainingModuleId: string | null;
  required: boolean;
  onboarding: boolean;
  appliesToPositions: string[];
  appliesToLocations: string[];
  expiresAfterDays: number | null;
  active: boolean;
}

export async function saveRequirementType(db: Db, id: string | null, input: RequirementTypeInput): Promise<Row> {
  const row = {
    slug: input.slug,
    title: input.title,
    description: input.description,
    category: input.category,
    kind: input.kind,
    external_url: input.externalUrl,
    training_module_id: input.trainingModuleId,
    required: input.required,
    onboarding: input.onboarding,
    applies_to_positions: input.appliesToPositions,
    applies_to_locations: input.appliesToLocations,
    expires_after_days: input.expiresAfterDays,
    active: input.active,
  };
  if (id) return db.update<Row>('requirement_types', id, row);
  const existing = await db.list<Row>('requirement_types');
  return db.insert<Row>('requirement_types', { ...row, sort: existing.length * 10 + 200, created_at: new Date().toISOString() });
}
