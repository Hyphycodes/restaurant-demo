import 'server-only';

import type { TimeOffRequest, TimeOffStatus } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';
import { employeeMap } from './employees';

export function timeOffFromRow(row: Row, employeeName: string): TimeOffRequest {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeeName,
    startsOn: String(row.starts_on),
    endsOn: String(row.ends_on),
    reason: (row.reason as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    status: (row.status as TimeOffStatus) ?? 'pending',
    decidedAt: (row.decided_at as string | null) ?? null,
    decisionNote: (row.decision_note as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
  };
}

export async function listTimeOff(db: Db, filter: { employeeId?: string; status?: TimeOffStatus; from?: string } = {}): Promise<TimeOffRequest[]> {
  const where: Record<string, string> = {};
  if (filter.employeeId) where.employee_id = filter.employeeId;
  if (filter.status) where.status = filter.status;
  const [rows, employees] = await Promise.all([db.list<Row>('time_off_requests', { where, orderBy: 'starts_on', desc: true }), employeeMap(db)]);
  return rows
    .map((row) => timeOffFromRow(row, employees.get(String(row.employee_id))?.displayName ?? 'Employee'))
    .filter((request) => !filter.from || request.endsOn >= filter.from);
}

export async function getTimeOff(db: Db, id: string): Promise<TimeOffRequest | null> {
  const row = await db.get<Row>('time_off_requests', id);
  if (!row) return null;
  const employees = await employeeMap(db);
  return timeOffFromRow(row, employees.get(String(row.employee_id))?.displayName ?? 'Employee');
}

export async function requestTimeOff(db: Db, employeeId: string, input: { startsOn: string; endsOn: string; reason: string | null; note: string | null }): Promise<TimeOffRequest> {
  const row = await db.insert<Row>('time_off_requests', {
    employee_id: employeeId,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    reason: input.reason,
    note: input.note,
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  return timeOffFromRow(row, '');
}

export async function withdrawTimeOff(db: Db, employeeId: string, id: string): Promise<void> {
  const row = await db.get<Row>('time_off_requests', id);
  if (!row || row.employee_id !== employeeId) throw new Error('That request is not yours.');
  if (row.status !== 'pending') throw new Error('Only a pending request can be withdrawn.');
  await db.update('time_off_requests', id, { status: 'cancelled' });
}

/**
 * The decision. The caller has already proved it is a manager; this
 * function additionally refuses a manager deciding their own request, which
 * the brief calls out and which no amount of role checking would otherwise
 * catch.
 */
export async function decideTimeOff(db: Db, id: string, status: 'approved' | 'denied', note: string | null, actor: Staff, actorEmployeeId: string | null): Promise<{ before: Row; after: TimeOffRequest }> {
  const row = await db.get<Row>('time_off_requests', id);
  if (!row) throw new Error('That request no longer exists.');
  if (actorEmployeeId && row.employee_id === actorEmployeeId) {
    throw new Error('You cannot approve your own time off. Ask another manager.');
  }
  if (row.status !== 'pending') throw new Error('That request has already been decided.');
  const after = await db.update<Row>('time_off_requests', id, {
    status,
    decided_by: actor.source === 'supabase' ? actor.id : null,
    decided_at: new Date().toISOString(),
    decision_note: note,
  });
  return { before: row, after: timeOffFromRow(after, '') };
}
