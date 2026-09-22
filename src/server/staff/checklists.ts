import 'server-only';

import type { ChecklistRun, ChecklistRunItem, ChecklistTemplate } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';
import { employeeMap } from './employees';
import { eventSummaries } from './events';

/**
 * Operating checklists: a template a manager writes once, a run for each
 * day, shift or event it is used on. Items are copied into the run so a
 * later edit to the template does not rewrite what was ticked last Friday.
 */

export async function listTemplates(db: Db, options: { includeInactive?: boolean } = {}): Promise<ChecklistTemplate[]> {
  const [rows, items] = await Promise.all([db.list<Row>('checklist_templates', { orderBy: 'title' }), db.list<Row>('checklist_template_items', { orderBy: 'sort' })]);
  return rows
    .filter((row) => !row.archived_at && (options.includeInactive || row.active !== false))
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      description: (row.description as string | null) ?? null,
      kind: String(row.kind ?? 'other'),
      locationId: (row.location_id as string | null) ?? null,
      positionId: (row.position_id as string | null) ?? null,
      active: row.active !== false,
      items: items
        .filter((item) => item.template_id === row.id)
        .map((item) => ({ id: String(item.id), sort: Number(item.sort ?? 0), label: String(item.label), requiresPhoto: item.requires_photo === true, requiresNote: item.requires_note === true })),
    }));
}

export async function getTemplate(db: Db, id: string): Promise<ChecklistTemplate | null> {
  return (await listTemplates(db, { includeInactive: true })).find((template) => template.id === id) ?? null;
}

export interface TemplateInput {
  title: string;
  description: string | null;
  kind: string;
  locationId: string | null;
  positionId: string | null;
  active: boolean;
  items: { label: string; requiresPhoto: boolean; requiresNote: boolean }[];
}

export async function saveTemplate(db: Db, id: string | null, input: TemplateInput, actor: Staff): Promise<Row> {
  const base = { title: input.title, description: input.description, kind: input.kind, location_id: input.locationId, position_id: input.positionId, active: input.active };
  const row = id
    ? await db.update<Row>('checklist_templates', id, base)
    : await db.insert<Row>('checklist_templates', { ...base, created_by: actor.source === 'supabase' ? actor.id : null, created_at: new Date().toISOString() });
  const templateId = String(row.id);
  for (const item of await db.list<Row>('checklist_template_items', { where: { template_id: templateId } })) await db.remove('checklist_template_items', String(item.id));
  let sort = 0;
  for (const item of input.items) {
    await db.insert('checklist_template_items', { template_id: templateId, sort: (sort += 10), label: item.label, requires_photo: item.requiresPhoto, requires_note: item.requiresNote });
  }
  return row;
}

function runItemFromRow(row: Row, completedByName: string | null): ChecklistRunItem {
  return {
    id: String(row.id),
    sort: Number(row.sort ?? 0),
    label: String(row.label),
    requiresPhoto: row.requires_photo === true,
    requiresNote: row.requires_note === true,
    completedAt: (row.completed_at as string | null) ?? null,
    completedByName,
    note: (row.note as string | null) ?? null,
    photoPath: (row.photo_path as string | null) ?? null,
  };
}

export async function listRuns(db: Db, filter: { onDate?: string; from?: string; to?: string; locationId?: string; assignedEmployeeId?: string; eventId?: string; shiftId?: string } = {}): Promise<ChecklistRun[]> {
  const where: Record<string, string> = {};
  if (filter.onDate) where.on_date = filter.onDate;
  if (filter.locationId) where.location_id = filter.locationId;
  if (filter.assignedEmployeeId) where.assigned_employee_id = filter.assignedEmployeeId;
  if (filter.eventId) where.event_id = filter.eventId;
  if (filter.shiftId) where.shift_id = filter.shiftId;
  const range = filter.from || filter.to ? { column: 'on_date', from: filter.from, to: filter.to } : undefined;
  const rows = await db.list<Row>('checklist_runs', { where, range, orderBy: 'on_date', desc: true });
  if (rows.length === 0) return [];
  const [items, employees, events] = await Promise.all([
    db.list<Row>('checklist_run_items', { whereIn: { run_id: rows.map((row) => String(row.id)) }, orderBy: 'sort' }),
    employeeMap(db),
    eventSummaries(db, rows.map((row) => row.event_id as string | null).filter((id): id is string => Boolean(id))),
  ]);
  return rows.map((row) => {
    const mine = items.filter((item) => item.run_id === row.id).map((item) => runItemFromRow(item, item.completed_by ? (employees.get(String(item.completed_by))?.displayName ?? null) : null));
    return {
      id: String(row.id),
      templateId: String(row.template_id),
      title: String(row.title),
      onDate: String(row.on_date),
      locationId: (row.location_id as string | null) ?? null,
      eventId: (row.event_id as string | null) ?? null,
      eventTitle: row.event_id ? (events.get(String(row.event_id))?.title ?? null) : null,
      shiftId: (row.shift_id as string | null) ?? null,
      positionId: (row.position_id as string | null) ?? null,
      assignedEmployeeId: (row.assigned_employee_id as string | null) ?? null,
      assignedEmployeeName: row.assigned_employee_id ? (employees.get(String(row.assigned_employee_id))?.displayName ?? null) : null,
      status: (row.status as ChecklistRun['status']) ?? 'open',
      startedAt: (row.started_at as string | null) ?? null,
      completedAt: (row.completed_at as string | null) ?? null,
      verifiedAt: (row.verified_at as string | null) ?? null,
      items: mine,
      done: mine.filter((item) => item.completedAt).length,
      total: mine.length,
    };
  });
}

export async function getRun(db: Db, id: string): Promise<ChecklistRun | null> {
  const row = await db.get<Row>('checklist_runs', id);
  if (!row) return null;
  return (await listRuns(db, { onDate: String(row.on_date) })).find((run) => run.id === id) ?? null;
}

export interface RunInput {
  templateId: string;
  onDate: string;
  locationId: string | null;
  eventId: string | null;
  shiftId: string | null;
  positionId: string | null;
  assignedEmployeeId: string | null;
}

export async function startRun(db: Db, input: RunInput, actor: Staff): Promise<Row> {
  const template = await getTemplate(db, input.templateId);
  if (!template) throw new Error('That checklist no longer exists.');
  const run = await db.insert<Row>('checklist_runs', {
    template_id: template.id,
    title: template.title,
    on_date: input.onDate,
    location_id: input.locationId ?? template.locationId,
    event_id: input.eventId,
    shift_id: input.shiftId,
    position_id: input.positionId ?? template.positionId,
    assigned_employee_id: input.assignedEmployeeId,
    status: 'open',
    created_by: actor.source === 'supabase' ? actor.id : null,
    created_at: new Date().toISOString(),
  });
  for (const item of template.items) {
    await db.insert('checklist_run_items', { run_id: String(run.id), sort: item.sort, label: item.label, requires_photo: item.requiresPhoto, requires_note: item.requiresNote });
  }
  return run;
}

/** Ticks or unticks one line; completes the run when the last line is done. */
export async function setRunItem(db: Db, runId: string, itemId: string, employeeId: string | null, input: { done: boolean; note: string | null; photoPath: string | null }): Promise<ChecklistRun> {
  const item = await db.get<Row>('checklist_run_items', itemId);
  if (!item || item.run_id !== runId) throw new Error('That line is not on this checklist.');
  const now = new Date().toISOString();
  await db.update('checklist_run_items', itemId, {
    completed_at: input.done ? now : null,
    completed_by: input.done ? employeeId : null,
    note: input.note ?? item.note ?? null,
    photo_path: input.photoPath ?? item.photo_path ?? null,
  });
  const run = await db.get<Row>('checklist_runs', runId);
  const items = await db.list<Row>('checklist_run_items', { where: { run_id: runId } });
  const allDone = items.length > 0 && items.every((entry) => entry.completed_at);
  await db.update('checklist_runs', runId, {
    started_at: run?.started_at ?? now,
    status: allDone ? 'complete' : 'open',
    completed_at: allDone ? (run?.completed_at ?? now) : null,
  });
  return (await getRun(db, runId))!;
}

export async function verifyRun(db: Db, runId: string, actor: Staff): Promise<Row> {
  return db.update<Row>('checklist_runs', runId, { status: 'verified', verified_by: actor.source === 'supabase' ? actor.id : null, verified_at: new Date().toISOString() });
}
