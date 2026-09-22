'use server';

import type { EmployeeNote } from '@/content/staff-types';
import { recordOpsAudit } from '@/server/staff/audit';
import { addNote, archiveNote } from '@/server/staff/notes';
import { fail, runOps, savedOps, text, type ActionState } from './shared';

export async function addManagerNote(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('notes.manage', async ({ db, context }) => {
    const employeeId = text(form, 'employeeId');
    const body = text(form, 'body');
    if (!body) return fail('Write the note first.');
    const kind = text(form, 'kind') as EmployeeNote['kind'];
    const row = await addNote(db, employeeId, ['coaching', 'attendance', 'recognition', 'follow_up', 'other'].includes(kind) ? kind : 'other', body.slice(0, 4000), context.staff);
    await recordOpsAudit(context.staff, 'note.added', 'employee_note', String(row.id), { after: { employeeId, kind } });
    return savedOps('Note saved. Only managers can see it.');
  });
}

export async function removeManagerNote(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('notes.manage', async ({ db, context }) => {
    const id = text(form, 'id');
    await archiveNote(db, id);
    await recordOpsAudit(context.staff, 'note.archived', 'employee_note', id);
    return savedOps('Note removed.');
  });
}
