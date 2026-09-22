'use server';

import { recordOpsAudit } from '@/server/staff/audit';
import { getRun, saveTemplate, setRunItem, startRun, verifyRun } from '@/server/staff/checklists';
import { employeeFilePath, fileProblem, storeEmployeeFile } from '@/server/staff/storage';
import { bool, fail, isoDate, optional, runOps, savedOps, text, type ActionState } from './shared';

export async function saveChecklistTemplate(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('checklists.manage', async ({ db, context }) => {
    const title = text(form, 'title');
    if (!title) return fail('Give the checklist a title.');
    const lines = (optional(form, 'items') ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return fail('Add at least one line, one per row.');
    const items = lines.map((line) => {
      const requiresPhoto = /\[photo\]/i.test(line);
      const requiresNote = /\[note\]/i.test(line);
      return { label: line.replace(/\[(photo|note)\]/gi, '').trim(), requiresPhoto, requiresNote };
    });
    const id = optional(form, 'id');
    const row = await saveTemplate(db, id, { title, description: optional(form, 'description'), kind: text(form, 'kind') || 'other', locationId: optional(form, 'locationId'), positionId: optional(form, 'positionId'), active: !bool(form, 'archived'), items }, context.staff);
    await recordOpsAudit(context.staff, id ? 'checklist_template.edited' : 'checklist_template.created', 'checklist_template', String(row.id), { after: { title, items: items.length } });
    return savedOps(id ? 'Checklist saved.' : 'Checklist created.');
  });
}

export async function startChecklist(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('checklists.manage', async ({ db, context }) => {
    const onDate = isoDate(optional(form, 'onDate')) ?? new Date().toISOString().slice(0, 10);
    const row = await startRun(db, { templateId: text(form, 'templateId'), onDate, locationId: optional(form, 'locationId') ?? context.location.id, eventId: optional(form, 'eventId'), shiftId: optional(form, 'shiftId'), positionId: optional(form, 'positionId'), assignedEmployeeId: optional(form, 'assignedEmployeeId') }, context.staff);
    return { ...savedOps('Checklist started.'), affected: [`/staff/checklists/${String(row.id)}`] };
  });
}

export async function tickChecklistItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('checklists.complete', async ({ db, context }) => {
    const runId = text(form, 'runId');
    const itemId = text(form, 'itemId');
    const run = await getRun(db, runId);
    if (!run) return fail('That checklist no longer exists.');
    const employee = context.employee;
    if (!context.isManager && run.assignedEmployeeId && run.assignedEmployeeId !== employee?.id) return fail('That checklist is assigned to someone else.');
    const done = bool(form, 'done');
    let photoPath: string | null = null;
    const file = form.get('photo');
    if (file instanceof File && file.size > 0) {
      const problem = fileProblem(file);
      if (problem) return fail(problem);
      const stored = await storeEmployeeFile(employeeFilePath(employee?.id ?? 'house', `checklists/${runId}`, file.name), file);
      if ('error' in stored) return fail(stored.error);
      photoPath = stored.path;
    }
    const item = run.items.find((entry) => entry.id === itemId);
    if (done && item?.requiresPhoto && !photoPath && !item.photoPath) return fail('This line needs a photo.');
    if (done && item?.requiresNote && !optional(form, 'note') && !item.note) return fail('This line needs a note.');
    const updated = await setRunItem(db, runId, itemId, employee?.id ?? null, { done, note: optional(form, 'note'), photoPath });
    return savedOps(updated.status === 'complete' ? `${updated.title} complete. All ${updated.total} done.` : '');
  });
}

export async function verifyChecklist(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('checklists.manage', async ({ db, context }) => {
    const id = text(form, 'id');
    await verifyRun(db, id, context.staff);
    await recordOpsAudit(context.staff, 'checklist.verified', 'checklist_run', id);
    return savedOps('Verified.');
  });
}
