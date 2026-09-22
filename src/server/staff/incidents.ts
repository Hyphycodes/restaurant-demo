import 'server-only';

import type { Incident, IncidentCategory } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';
import { employeeMap } from './employees';
import { eventSummaries } from './events';

/** Manager-only, and the RLS policy says so too. Employees never query this table. */

export async function listIncidents(db: Db, filter: { locationId?: string; status?: Incident['followUpStatus']; eventId?: string; limit?: number } = {}): Promise<Incident[]> {
  const where: Record<string, string> = {};
  if (filter.locationId) where.location_id = filter.locationId;
  if (filter.status) where.follow_up_status = filter.status;
  if (filter.eventId) where.event_id = filter.eventId;
  const rows = (await db.list<Row>('incidents', { where, orderBy: 'occurred_at', desc: true, limit: filter.limit })).filter((row) => !row.archived_at);
  if (rows.length === 0) return [];
  const [links, employees, events] = await Promise.all([
    db.list<Row>('incident_employees', { whereIn: { incident_id: rows.map((row) => String(row.id)) } }),
    employeeMap(db),
    eventSummaries(db, rows.map((row) => row.event_id as string | null).filter((id): id is string => Boolean(id))),
  ]);
  return rows.map((row) => ({
    id: String(row.id),
    occurredAt: String(row.occurred_at),
    locationId: (row.location_id as string | null) ?? null,
    eventId: (row.event_id as string | null) ?? null,
    eventTitle: row.event_id ? (events.get(String(row.event_id))?.title ?? null) : null,
    category: (row.category as IncidentCategory) ?? 'other',
    summary: String(row.summary),
    description: (row.description as string | null) ?? null,
    actionsTaken: (row.actions_taken as string | null) ?? null,
    attachmentPaths: (row.attachment_paths as string[]) ?? [],
    followUpStatus: (row.follow_up_status as Incident['followUpStatus']) ?? 'open',
    reporterName: String(row.reporter_name ?? ''),
    employees: links
      .filter((link) => link.incident_id === row.id)
      .map((link) => ({ employeeId: String(link.employee_id), name: employees.get(String(link.employee_id))?.displayName ?? 'Employee', involvement: String(link.involvement ?? 'involved') })),
    createdAt: String(row.created_at ?? ''),
  }));
}

export async function getIncident(db: Db, id: string): Promise<Incident | null> {
  return (await listIncidents(db)).find((incident) => incident.id === id) ?? null;
}

export interface IncidentInput {
  occurredAt: string;
  locationId: string | null;
  eventId: string | null;
  category: IncidentCategory;
  summary: string;
  description: string | null;
  actionsTaken: string | null;
  followUpStatus: Incident['followUpStatus'];
  employeeIds: string[];
  attachmentPaths?: string[];
}

export async function saveIncident(db: Db, id: string | null, input: IncidentInput, actor: Staff): Promise<{ before: Row | null; after: Row }> {
  const base = {
    occurred_at: input.occurredAt,
    location_id: input.locationId,
    event_id: input.eventId,
    category: input.category,
    summary: input.summary,
    description: input.description,
    actions_taken: input.actionsTaken,
    follow_up_status: input.followUpStatus,
  };
  let before: Row | null = null;
  let after: Row;
  if (id) {
    before = await db.get<Row>('incidents', id);
    if (!before) throw new Error('That incident no longer exists.');
    after = await db.update<Row>('incidents', id, { ...base, attachment_paths: [...((before.attachment_paths as string[]) ?? []), ...(input.attachmentPaths ?? [])] });
    for (const link of await db.list<Row>('incident_employees', { where: { incident_id: id } })) await db.remove('incident_employees', String(link.id));
  } else {
    after = await db.insert<Row>('incidents', {
      ...base,
      attachment_paths: input.attachmentPaths ?? [],
      reported_by: actor.source === 'supabase' ? actor.id : null,
      reporter_name: actor.name || actor.email,
      created_at: new Date().toISOString(),
    });
  }
  for (const employeeId of new Set(input.employeeIds)) {
    await db.insert('incident_employees', { incident_id: String(after.id), employee_id: employeeId, involvement: 'involved' });
  }
  return { before, after };
}
