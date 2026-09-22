import 'server-only';

import type { EmployeeNote } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';

/**
 * Manager notes about an employee. Read only through `listNotes`, which is
 * only called after `requireOps('notes.manage')`; the RLS policy grants
 * the table to managers and nobody else, so a direct API call by the
 * employee the note is about returns nothing.
 */

export async function listNotes(db: Db, employeeId: string): Promise<EmployeeNote[]> {
  const rows = await db.list<Row>('employee_notes', { where: { employee_id: employeeId }, orderBy: 'created_at', desc: true });
  return rows
    .filter((row) => !row.archived_at)
    .map((row) => ({
      id: String(row.id),
      employeeId,
      authorName: String(row.author_name ?? ''),
      kind: (row.kind as EmployeeNote['kind']) ?? 'other',
      body: String(row.body),
      createdAt: String(row.created_at ?? ''),
    }));
}

export async function addNote(db: Db, employeeId: string, kind: EmployeeNote['kind'], body: string, actor: Staff): Promise<Row> {
  return db.insert<Row>('employee_notes', {
    employee_id: employeeId,
    author_id: actor.source === 'supabase' ? actor.id : null,
    author_name: actor.name || actor.email,
    kind,
    body,
    created_at: new Date().toISOString(),
  });
}

export async function archiveNote(db: Db, id: string): Promise<void> {
  await db.update('employee_notes', id, { archived_at: new Date().toISOString() });
}
