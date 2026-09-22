import 'server-only';

import type { Task, TaskPriority, TaskStatus } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';
import { employeeMap } from './employees';
import { eventSummaries } from './events';

export function taskFromRow(row: Row, names: { assignee: string | null; assigner: string | null; event: string | null }, now: Date): Task {
  const dueAt = (row.due_at as string | null) ?? null;
  const status = (row.status as TaskStatus) ?? 'open';
  return {
    id: String(row.id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    assignedTo: (row.assigned_to as string | null) ?? null,
    assignedToName: names.assignee,
    assignedByName: names.assigner,
    locationId: (row.location_id as string | null) ?? null,
    eventId: (row.event_id as string | null) ?? null,
    eventTitle: names.event,
    dueAt,
    priority: (row.priority as TaskPriority) ?? 'normal',
    status,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
    overdue: status !== 'done' && dueAt !== null && Date.parse(dueAt) < now.getTime(),
  };
}

const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export async function listTasks(db: Db, filter: { assignedTo?: string; eventId?: string; locationId?: string; open?: boolean; includeDone?: boolean } = {}, now = new Date()): Promise<Task[]> {
  const where: Record<string, string> = {};
  if (filter.assignedTo) where.assigned_to = filter.assignedTo;
  if (filter.eventId) where.event_id = filter.eventId;
  if (filter.locationId) where.location_id = filter.locationId;
  const rows = (await db.list<Row>('tasks', { where, orderBy: 'created_at', desc: true })).filter((row) => !row.archived_at);
  const [employees, events] = await Promise.all([employeeMap(db), eventSummaries(db, rows.map((row) => row.event_id as string | null).filter((id): id is string => Boolean(id)))]);
  return rows
    .map((row) =>
      taskFromRow(
        row,
        {
          assignee: row.assigned_to ? (employees.get(String(row.assigned_to))?.displayName ?? null) : null,
          assigner: (row.assigned_by_name as string | null) ?? null,
          event: row.event_id ? (events.get(String(row.event_id))?.title ?? null) : null,
        },
        now,
      ),
    )
    .filter((task) => (filter.includeDone ? true : filter.open ? task.status !== 'done' : true))
    .sort((a, b) => {
      if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
      if (a.dueAt || b.dueAt) return a.dueAt ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
}

export async function getTask(db: Db, id: string): Promise<Task | null> {
  const list = await listTasks(db, { includeDone: true });
  return list.find((task) => task.id === id) ?? null;
}

export interface TaskInput {
  title: string;
  description: string | null;
  assignedTo: string | null;
  locationId: string | null;
  eventId: string | null;
  dueAt: string | null;
  priority: TaskPriority;
}

export async function createTask(db: Db, input: TaskInput, actor: Staff): Promise<Row> {
  return db.insert<Row>('tasks', {
    title: input.title,
    description: input.description,
    assigned_to: input.assignedTo,
    assigned_by: actor.source === 'supabase' ? actor.id : null,
    location_id: input.locationId,
    event_id: input.eventId,
    due_at: input.dueAt,
    priority: input.priority,
    status: 'open',
    created_at: new Date().toISOString(),
  });
}

export async function updateTask(db: Db, id: string, input: TaskInput): Promise<{ before: Row; after: Row }> {
  const before = await db.get<Row>('tasks', id);
  if (!before) throw new Error('That task no longer exists.');
  const after = await db.update<Row>('tasks', id, {
    title: input.title,
    description: input.description,
    assigned_to: input.assignedTo,
    location_id: input.locationId,
    event_id: input.eventId,
    due_at: input.dueAt,
    priority: input.priority,
  });
  return { before, after };
}

/** The one write an employee makes on a task: its status. */
export async function setTaskStatus(db: Db, id: string, status: TaskStatus): Promise<Row> {
  return db.update<Row>('tasks', id, { status, completed_at: status === 'done' ? new Date().toISOString() : null });
}

export async function archiveTask(db: Db, id: string): Promise<void> {
  await db.update('tasks', id, { archived_at: new Date().toISOString() });
}
