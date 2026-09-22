'use server';

import { addComment, type CommentEntity } from '@/server/staff/comments';
import { markNotificationsRead } from '@/server/staff/notifications';
import { markRead } from '@/server/staff/announcements';
import { fail, runOps, savedOps, text, type ActionState } from './shared';

export async function markAllRead(): Promise<ActionState> {
  return runOps('staff.view_self', async ({ db, context }) => {
    if (!context.employee) return fail('Your account is not set up as an employee yet.');
    await markNotificationsRead(db, context.employee.id, 'all');
    return savedOps('');
  });
}

export async function acknowledgeAnnouncement(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('staff.view_self', async ({ db, context }) => {
    if (!context.employee) return fail('Your account is not set up as an employee yet.');
    await markRead(db, text(form, 'id'), context.employee.id, true);
    return savedOps('Thanks — marked as read.');
  });
}

export async function markAnnouncementRead(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('staff.view_self', async ({ db, context }) => {
    if (!context.employee) return fail('Your account is not set up as an employee yet.');
    await markRead(db, text(form, 'id'), context.employee.id, false);
    return savedOps('');
  });
}

const ENTITIES: CommentEntity[] = ['task', 'time_off_request', 'shift_request', 'incident', 'event_staffing', 'shift', 'checklist_run'];

export async function postComment(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('staff.view_self', async ({ db, context }) => {
    const entityType = text(form, 'entityType') as CommentEntity;
    const entityId = text(form, 'entityId');
    const body = text(form, 'body');
    if (!ENTITIES.includes(entityType) || !entityId) return fail('Could not tell what this comment is about.');
    if (!body) return fail('Write something first.');
    if (entityType === 'incident' && !context.isManager) return fail('Only a manager can comment on an incident.');
    await addComment(db, entityType, entityId, body.slice(0, 2000), context.staff);
    return savedOps('Comment posted.');
  });
}
