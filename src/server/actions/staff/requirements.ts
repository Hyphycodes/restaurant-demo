'use server';

import type { RequirementKind } from '@/content/staff-types';
import { recordOpsAudit } from '@/server/staff/audit';
import { getEmployee } from '@/server/staff/employees';
import { notify } from '@/server/staff/notifications';
import { acknowledgeRequirement, listRequirementTypes, saveRequirementType, submitRequirementFile, verifyRequirement } from '@/server/staff/requirements';
import { employeeFilePath, fileProblem, storeEmployeeFile } from '@/server/staff/storage';
import { canSeeEmployee } from '@/server/staff/session';
import { bool, fail, integer, isoDate, list, optional, runOps, savedOps, text, type ActionState } from './shared';

export async function acknowledge(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('documents.view_self', async ({ db, context }) => {
    const employee = context.employee;
    if (!employee) return fail('Your account is not set up as an employee yet.');
    if (!bool(form, 'confirm')) return fail('Tick the box to confirm you have read it.');
    await acknowledgeRequirement(db, employee.id, text(form, 'typeId'));
    return savedOps('Acknowledged. Thank you.');
  });
}

/** An upload for the signed-in employee, or for someone else by a manager. */
export async function uploadDocument(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('documents.view_self', async ({ db, context }) => {
    const employeeId = optional(form, 'employeeId') ?? context.employee?.id ?? null;
    if (!employeeId || !canSeeEmployee(context, employeeId)) return fail('That is not yours to change.');
    const typeId = text(form, 'typeId');
    const file = form.get('file');
    let filePath: string | null = null;
    let fileName: string | null = null;
    if (file instanceof File && file.size > 0) {
      const problem = fileProblem(file);
      if (problem) return fail(problem);
      const stored = await storeEmployeeFile(employeeFilePath(employeeId, 'requirements', file.name), file);
      if ('error' in stored) return fail(stored.error);
      filePath = stored.path;
      fileName = file.name;
    }
    const issuedOn = isoDate(optional(form, 'issuedOn'));
    const expiresOn = isoDate(optional(form, 'expiresOn'));
    if (!filePath && !issuedOn && !optional(form, 'credentialNumber')) return fail('Add the file, or at least the dates on it.');
    await submitRequirementFile(db, employeeId, typeId, { filePath, fileName, credentialNumber: optional(form, 'credentialNumber'), issuedOn, expiresOn });
    return savedOps(context.isManager && employeeId !== context.employee?.id ? 'Uploaded. Verify it below when you have checked it.' : 'Uploaded. A manager will verify it.');
  });
}

export async function verifyDocument(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('documents.manage', async ({ db, context }) => {
    const employeeId = text(form, 'employeeId');
    const typeId = text(form, 'typeId');
    const status = text(form, 'status');
    if (!['complete', 'waived', 'missing'].includes(status)) return fail('Pick what to do with it.');
    const { before, after } = await verifyRequirement(db, employeeId, typeId, context.staff, { status: status as 'complete' | 'waived' | 'missing', note: optional(form, 'note'), expiresOn: form.has('expiresOn') ? isoDate(optional(form, 'expiresOn')) : undefined });
    await recordOpsAudit(context.staff, `document.${status === 'missing' ? 'rejected' : status === 'waived' ? 'waived' : 'verified'}`, 'employee_requirement', String(after.id), { before, after });
    const type = (await listRequirementTypes(db, { includeInactive: true })).find((entry) => entry.id === typeId);
    await notify({ employeeIds: [employeeId], kind: 'document_verified', title: status === 'complete' ? `${type?.title ?? 'Document'} verified` : status === 'waived' ? `${type?.title ?? 'Document'} waived` : `${type?.title ?? 'Document'} needs another look`, body: optional(form, 'note'), href: '/staff/documents', entityType: 'employee_requirement', entityId: String(after.id) });
    return savedOps(status === 'complete' ? 'Verified.' : status === 'waived' ? 'Waived for this person.' : 'Sent back. The employee has been told.');
  });
}

export async function saveRequirementTypeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('documents.manage', async ({ db, context }) => {
    const title = text(form, 'title');
    if (!title) return fail('Give it a title.');
    const kind = text(form, 'kind') as RequirementKind;
    if (!['acknowledgement', 'upload', 'link', 'manager_verify', 'training_module'].includes(kind)) return fail('Pick how it is completed.');
    const id = optional(form, 'id');
    const slug = (optional(form, 'slug') ?? title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const row = await saveRequirementType(db, id, {
      slug,
      title,
      description: optional(form, 'description'),
      category: text(form, 'category') || 'other',
      kind,
      externalUrl: optional(form, 'externalUrl'),
      trainingModuleId: optional(form, 'trainingModuleId'),
      required: bool(form, 'required'),
      onboarding: bool(form, 'onboarding'),
      appliesToPositions: list(form, 'positions'),
      appliesToLocations: list(form, 'locations'),
      expiresAfterDays: integer(form, 'expiresAfterDays'),
      active: !bool(form, 'archived'),
    });
    await recordOpsAudit(context.staff, id ? 'requirement_type.edited' : 'requirement_type.created', 'requirement_type', String(row.id), { after: { title, kind, required: bool(form, 'required') } });
    return savedOps(id ? 'Requirement saved.' : 'Requirement added. New employees get it automatically; existing ones see it on their documents page.');
  });
}

export async function completeOnboarding(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('staff.manage_team', async ({ db, context }) => {
    const employeeId = text(form, 'employeeId');
    const employee = await getEmployee(db, employeeId);
    if (!employee) return fail('That employee no longer exists.');
    await db.update('employees', employeeId, { onboarding_completed_at: new Date().toISOString(), status: employee.status === 'invited' ? 'active' : employee.status });
    await recordOpsAudit(context.staff, 'onboarding.completed', 'employee', employeeId, { after: { by: context.staff.name } });
    return savedOps(`${employee.displayName} is ready for their first shift.`);
  });
}
