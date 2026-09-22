'use server';

import { audienceFor, saveAnnouncement } from '@/server/staff/announcements';
import { recordOpsAudit } from '@/server/staff/audit';
import { notify } from '@/server/staff/notifications';
import { bool, fail, list, optional, runOps, savedOps, text, type ActionState } from './shared';

export async function saveAnnouncementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('announcements.manage', async ({ db, context }) => {
    const title = text(form, 'title');
    const body = text(form, 'body');
    if (!title) return fail('Give it a title.');
    if (!body) return fail('Write the announcement.');
    const id = optional(form, 'id');
    const publish = text(form, 'intent') !== 'draft';
    const row = await saveAnnouncement(db, id, {
      title,
      body,
      kind: text(form, 'kind') === 'urgent' ? 'urgent' : 'general',
      locationId: optional(form, 'locationId'),
      positions: list(form, 'positions'),
      eventId: optional(form, 'eventId'),
      requiresAck: bool(form, 'requiresAck'),
      publish,
      expiresAt: optional(form, 'expiresAt'),
    }, context.staff);
    await recordOpsAudit(context.staff, id ? 'announcement.edited' : 'announcement.posted', 'staff_announcement', String(row.id), { after: { title, publish } });
    if (publish && !id) {
      const audience = await audienceFor(db, row);
      await notify({ employeeIds: audience.map((employee) => employee.id), kind: 'announcement', title: `${row.kind === 'urgent' ? 'Urgent: ' : ''}${title}`, href: '/staff/announcements', entityType: 'staff_announcement', entityId: String(row.id) });
      return savedOps(`Posted to ${audience.length} ${audience.length === 1 ? 'person' : 'people'}.`);
    }
    return savedOps(publish ? 'Announcement saved.' : 'Saved as a draft.');
  });
}

export async function archiveAnnouncement(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('announcements.manage', async ({ db, context }) => {
    const id = text(form, 'id');
    await db.update('staff_announcements', id, { archived_at: new Date().toISOString() });
    await recordOpsAudit(context.staff, 'announcement.archived', 'staff_announcement', id);
    return savedOps('Taken down.');
  });
}
