'use server';

import type { TaskPriority, TaskStatus } from '@/content/staff-types';
import { recordOpsAudit } from '@/server/staff/audit';
import { notify } from '@/server/staff/notifications';
import { archiveTask, createTask, getTask, setTaskStatus, updateTask, type TaskInput } from '@/server/staff/tasks';
import { canSeeEmployee } from '@/server/staff/session';
import { fail, optional, runOps, savedOps, text, type ActionState } from './shared';

function taskInputFrom(form: FormData): { input: TaskInput; error: string | null } {
  const title = text(form, 'title');
  if (!title) return { input: null as never, error: 'Give the task a title.' };
  const priority = text(form, 'priority') as TaskPriority;
  const dueDate = optional(form, 'dueDate');
  const dueTime = optional(form, 'dueTime');
  const dueAt = optional(form, 'dueAt') ?? (dueDate ? `${dueDate}T${dueTime ?? '17:00'}:00` : null);
  return {
    input: {
      title,
      description: optional(form, 'description'),
      assignedTo: optional(form, 'assignedTo'),
      locationId: optional(form, 'locationId'),
      eventId: optional(form, 'eventId'),
      dueAt,
      priority: ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
    },
    error: null,
  };
}

export async function saveTask(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('tasks.manage', async ({ db, context }) => {
    const { input, error } = taskInputFrom(form);
    if (error) return fail(error);
    // A due "local" datetime is turned into an instant in the location's zone.
    if (input.dueAt && !input.dueAt.endsWith('Z')) {
      const { zonedInstant, minutesFromClock } = await import('@/lib/staff/time');
      const [date, clock] = input.dueAt.split('T');
      input.dueAt = zonedInstant(date!, minutesFromClock((clock ?? '17:00').slice(0, 5)) ?? 17 * 60, context.location.timezone);
    }
    const id = optional(form, 'id');
    if (id) {
      const { before, after } = await updateTask(db, id, input);
      await recordOpsAudit(context.staff, 'task.edited', 'task', id, { before, after });
      if (after.assigned_to && before.assigned_to !== after.assigned_to) {
        await notify({ employeeIds: [String(after.assigned_to)], kind: 'task_assigned', title: `New task: ${input.title}`, href: '/staff/tasks', entityType: 'task', entityId: id });
      }
      return savedOps('Task saved.');
    }
    const row = await createTask(db, input, context.staff);
    await recordOpsAudit(context.staff, 'task.created', 'task', String(row.id), { after: row });
    if (input.assignedTo) await notify({ employeeIds: [input.assignedTo], kind: 'task_assigned', title: `New task: ${input.title}`, body: input.description, href: '/staff/tasks', entityType: 'task', entityId: String(row.id) });
    return savedOps('Task added.');
  });
}

export async function changeTaskStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('tasks.view_self', async ({ db, context }) => {
    const id = text(form, 'id');
    const status = text(form, 'status') as TaskStatus;
    if (!['open', 'in_progress', 'blocked', 'done'].includes(status)) return fail('Unknown status.');
    const task = await getTask(db, id);
    if (!task) return fail('That task no longer exists.');
    if (!context.isManager && !(task.assignedTo && canSeeEmployee(context, task.assignedTo))) return fail('That task is not yours.');
    await setTaskStatus(db, id, status);
    return savedOps(status === 'done' ? 'Done. Nice.' : status === 'blocked' ? 'Marked blocked. Say why in a comment so a manager can help.' : '');
  });
}

export async function removeTask(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('tasks.manage', async ({ db, context }) => {
    const id = text(form, 'id');
    await archiveTask(db, id);
    await recordOpsAudit(context.staff, 'task.archived', 'task', id);
    return savedOps('Task removed.');
  });
}
