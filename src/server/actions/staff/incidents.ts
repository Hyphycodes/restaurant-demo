'use server';

import type { IncidentCategory } from '@/content/staff-types';
import { recordOpsAudit } from '@/server/staff/audit';
import { managersToNotify } from '@/server/staff/employees';
import { saveIncident } from '@/server/staff/incidents';
import { notify } from '@/server/staff/notifications';
import { contextCan } from '@/server/staff/session';
import { employeeFilePath, fileProblem, storeEmployeeFile } from '@/server/staff/storage';
import { fail, list, optional, runOps, savedOps, text, type ActionState } from './shared';

const CATEGORIES: IncidentCategory[] = ['guest', 'injury', 'security', 'equipment', 'payment', 'alcohol', 'other'];

/**
 * Recording something that happened.
 *
 * Both sides of the same table. An employee may WRITE one — they were
 * there, and a report that has to wait for a manager is a report that never
 * gets written — but may not read the log, edit an existing entry, close
 * one, or name other people in it. Those are narrowed here, on the server,
 * rather than by which form was rendered.
 */
export async function saveIncidentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runOps('incidents.report', async ({ db, context }) => {
    const reviews = contextCan(context, 'incidents.manage');
    const summary = text(form, 'summary');
    if (!summary) return fail('Say what happened in one line.');
    const category = text(form, 'category') as IncidentCategory;
    const followUp = text(form, 'followUpStatus');
    const occurredAt = optional(form, 'occurredAt') ?? new Date().toISOString();
    const attachments: string[] = [];
    for (const file of form.getAll('attachments')) {
      if (!(file instanceof File) || file.size === 0) continue;
      const problem = fileProblem(file);
      if (problem) return fail(problem);
      const stored = await storeEmployeeFile(employeeFilePath('house', 'incidents', file.name), file);
      if ('error' in stored) return fail(stored.error);
      attachments.push(stored.path);
    }
    const id = reviews ? optional(form, 'id') : null;
    const locationId = reviews ? optional(form, 'locationId') ?? context.location.id : context.location.id;
    // An employee's report names only themselves and always lands open.
    const employeeIds = reviews ? list(form, 'employeeIds') : context.employee ? [context.employee.id] : [];
    const { before, after } = await saveIncident(db, id, {
      occurredAt: occurredAt.length === 16 ? new Date(occurredAt).toISOString() : occurredAt,
      locationId,
      eventId: reviews ? optional(form, 'eventId') : null,
      category: CATEGORIES.includes(category) ? category : 'other',
      summary,
      description: optional(form, 'description'),
      actionsTaken: reviews ? optional(form, 'actionsTaken') : null,
      followUpStatus: reviews && ['open', 'monitoring', 'closed'].includes(followUp) ? (followUp as 'open' | 'monitoring' | 'closed') : 'open',
      employeeIds,
      attachmentPaths: attachments,
    }, context.staff);
    await recordOpsAudit(context.staff, id ? 'incident.edited' : 'incident.recorded', 'incident', String(after.id), { before, after: { ...after, description: undefined, actions_taken: undefined } });
    if (!id) {
      const managers = await managersToNotify(db, locationId);
      await notify({
        employeeIds: managers.filter((manager) => manager.id !== context.employee?.id).map((manager) => manager.id),
        kind: 'incident_reported',
        title: `Incident reported: ${summary}`,
        body: context.employee ? `From ${context.employee.displayName}` : null,
        href: `/staff/incidents/${String(after.id)}`,
        entityType: 'incident',
        entityId: String(after.id),
      });
    }
    if (!reviews) {
      return savedOps('Thanks — that’s with the managers. They’ll follow up with you if they need more.');
    }
    return { ...savedOps(id ? 'Incident updated.' : 'Incident recorded.'), affected: [`/staff/incidents/${String(after.id)}`] };
  });
}
