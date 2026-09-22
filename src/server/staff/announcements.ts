import 'server-only';

import type { EmployeeSummary, StaffAnnouncement } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';
import { listEmployees } from './employees';
import { eventSummaries } from './events';

/**
 * Staff announcements: general or urgent, aimed at a location, some
 * positions, or an event. Acknowledgement is per reader, and a manager can
 * see who has and has not.
 */

export function announcementApplies(row: Row, employee: EmployeeSummary): boolean {
  const locationId = (row.location_id as string | null) ?? null;
  if (locationId && employee.primaryLocationId !== locationId && !employee.locationIds.includes(locationId)) return false;
  const positions = (row.positions as string[]) ?? [];
  if (positions.length > 0 && !positions.some((id) => employee.positionIds.includes(id))) return false;
  return true;
}

function isLive(row: Row, now: Date): boolean {
  if (row.archived_at) return false;
  const published = row.published_at ? Date.parse(String(row.published_at)) : null;
  if (published === null || published > now.getTime()) return false;
  const expires = row.expires_at ? Date.parse(String(row.expires_at)) : null;
  return expires === null || expires > now.getTime();
}

async function toAnnouncement(db: Db, row: Row, read: Row | undefined, audience: { total: number; acknowledged: number } | null, eventTitle: string | null): Promise<StaffAnnouncement> {
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body ?? ''),
    kind: row.kind === 'urgent' ? 'urgent' : 'general',
    locationId: (row.location_id as string | null) ?? null,
    positions: (row.positions as string[]) ?? [],
    eventId: (row.event_id as string | null) ?? null,
    eventTitle,
    requiresAck: row.requires_ack === true,
    publishedAt: (row.published_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    authorName: String(row.author_name ?? ''),
    createdAt: String(row.created_at ?? ''),
    readAt: (read?.read_at as string | null) ?? null,
    acknowledgedAt: (read?.acknowledged_at as string | null) ?? null,
    audience: audience?.total ?? null,
    acknowledged: audience?.acknowledged ?? null,
  };
}

/** What one employee should see, newest first, unread first. */
export async function feedFor(db: Db, employee: EmployeeSummary, now = new Date()): Promise<StaffAnnouncement[]> {
  const [rows, reads] = await Promise.all([db.list<Row>('staff_announcements', { orderBy: 'published_at', desc: true }), db.list<Row>('staff_announcement_reads', { where: { employee_id: employee.id } })]);
  const live = rows.filter((row) => isLive(row, now) && announcementApplies(row, employee));
  const events = await eventSummaries(db, live.map((row) => row.event_id as string | null).filter((id): id is string => Boolean(id)));
  const feed = await Promise.all(live.map((row) => toAnnouncement(db, row, reads.find((read) => read.announcement_id === row.id), null, row.event_id ? (events.get(String(row.event_id))?.title ?? null) : null)));
  return feed.sort((a, b) => {
    const aOpen = a.requiresAck ? !a.acknowledgedAt : !a.readAt;
    const bOpen = b.requiresAck ? !b.acknowledgedAt : !b.readAt;
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === 'urgent' ? -1 : 1;
    return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
  });
}

/** Every announcement, with acknowledgement counts, for a manager. */
export async function listAllAnnouncements(db: Db): Promise<StaffAnnouncement[]> {
  const [rows, reads, employees] = await Promise.all([db.list<Row>('staff_announcements', { orderBy: 'created_at', desc: true }), db.list<Row>('staff_announcement_reads'), listEmployees(db)]);
  const events = await eventSummaries(db, rows.map((row) => row.event_id as string | null).filter((id): id is string => Boolean(id)));
  return Promise.all(
    rows
      .filter((row) => !row.archived_at)
      .map((row) => {
        const audience = employees.filter((employee) => announcementApplies(row, employee));
        const acknowledged = reads.filter((read) => read.announcement_id === row.id && (row.requires_ack ? read.acknowledged_at : read.read_at)).length;
        return toAnnouncement(db, row, undefined, { total: audience.length, acknowledged }, row.event_id ? (events.get(String(row.event_id))?.title ?? null) : null);
      }),
  );
}

export async function audienceFor(db: Db, row: Row): Promise<EmployeeSummary[]> {
  const employees = await listEmployees(db);
  return employees.filter((employee) => announcementApplies(row, employee));
}

export async function whoAcknowledged(db: Db, announcementId: string): Promise<{ employee: EmployeeSummary; readAt: string | null; acknowledgedAt: string | null }[]> {
  const row = await db.get<Row>('staff_announcements', announcementId);
  if (!row) return [];
  const [audience, reads] = await Promise.all([audienceFor(db, row), db.list<Row>('staff_announcement_reads', { where: { announcement_id: announcementId } })]);
  return audience.map((employee) => {
    const read = reads.find((entry) => entry.employee_id === employee.id);
    return { employee, readAt: (read?.read_at as string | null) ?? null, acknowledgedAt: (read?.acknowledged_at as string | null) ?? null };
  });
}

export interface AnnouncementInput {
  title: string;
  body: string;
  kind: 'general' | 'urgent';
  locationId: string | null;
  positions: string[];
  eventId: string | null;
  requiresAck: boolean;
  publish: boolean;
  expiresAt: string | null;
}

export async function saveAnnouncement(db: Db, id: string | null, input: AnnouncementInput, actor: Staff): Promise<Row> {
  const now = new Date().toISOString();
  const row = {
    title: input.title,
    body: input.body,
    kind: input.kind,
    location_id: input.locationId,
    positions: input.positions,
    event_id: input.eventId,
    requires_ack: input.requiresAck,
    expires_at: input.expiresAt,
  };
  if (id) {
    const existing = await db.get<Row>('staff_announcements', id);
    return db.update<Row>('staff_announcements', id, { ...row, published_at: input.publish ? (existing?.published_at ?? now) : null });
  }
  return db.insert<Row>('staff_announcements', { ...row, published_at: input.publish ? now : null, created_by: actor.source === 'supabase' ? actor.id : null, author_name: actor.name || actor.email, created_at: now });
}

export async function markRead(db: Db, announcementId: string, employeeId: string, acknowledge: boolean): Promise<void> {
  const existing = await db.list<Row>('staff_announcement_reads', { where: { announcement_id: announcementId, employee_id: employeeId } });
  const now = new Date().toISOString();
  const current = existing[0];
  if (current) {
    if (acknowledge && !current.acknowledged_at) await db.update('staff_announcement_reads', String(current.id), { acknowledged_at: now });
    return;
  }
  await db.insert('staff_announcement_reads', { announcement_id: announcementId, employee_id: employeeId, read_at: now, acknowledged_at: acknowledge ? now : null });
}
