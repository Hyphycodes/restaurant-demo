import 'server-only';

import type { EventBrief } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';
import { employeeMap } from './employees';

/**
 * The night brief: what the floor needs to know about an event.
 *
 * Deliberately small, and deliberately free of money. Everything here is
 * something an employee working that night is better for knowing — call
 * time, what to wear, who is running it, what to watch for — and nothing
 * here is anything they should not see. That is what lets `events.view_brief`
 * be an employee capability while `events.view_money` is not.
 */

export async function getBrief(db: Db, eventId: string): Promise<EventBrief | null> {
  try {
    const row = await db.get<Row>('event_briefs', eventId);
    if (!row) return null;
    const managerId = (row.manager_employee_id as string | null) ?? null;
    const employees = managerId ? await employeeMap(db) : null;
    return {
      eventId: String(row.event_id),
      callTimeAt: (row.call_time_at as string | null) ?? null,
      dressCode: (row.dress_code as string | null) ?? null,
      expectedGuests: row.expected_guests === null || row.expected_guests === undefined ? null : Number(row.expected_guests),
      managerEmployeeId: managerId,
      managerName: managerId ? (employees?.get(managerId)?.displayName ?? null) : null,
      staffNotes: (row.staff_notes as string | null) ?? null,
      updatedAt: (row.updated_at as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Briefs for several events at once, keyed by event id. Missing ones are simply absent. */
export async function briefsFor(db: Db, eventIds: string[]): Promise<Map<string, EventBrief>> {
  const unique = [...new Set(eventIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  try {
    const rows = await db.list<Row>('event_briefs', { whereIn: { event_id: unique } });
    if (rows.length === 0) return new Map();
    const employees = await employeeMap(db);
    return new Map(
      rows.map((row) => {
        const managerId = (row.manager_employee_id as string | null) ?? null;
        return [
          String(row.event_id),
          {
            eventId: String(row.event_id),
            callTimeAt: (row.call_time_at as string | null) ?? null,
            dressCode: (row.dress_code as string | null) ?? null,
            expectedGuests: row.expected_guests === null || row.expected_guests === undefined ? null : Number(row.expected_guests),
            managerEmployeeId: managerId,
            managerName: managerId ? (employees.get(managerId)?.displayName ?? null) : null,
            staffNotes: (row.staff_notes as string | null) ?? null,
            updatedAt: (row.updated_at as string | null) ?? null,
          } satisfies EventBrief,
        ];
      }),
    );
  } catch {
    return new Map();
  }
}

export interface BriefInput {
  callTimeAt: string | null;
  dressCode: string | null;
  expectedGuests: number | null;
  managerEmployeeId: string | null;
  staffNotes: string | null;
}

export async function saveBrief(db: Db, eventId: string, input: BriefInput, actor: Staff): Promise<EventBrief> {
  await db.upsert('event_briefs', {
    event_id: eventId,
    call_time_at: input.callTimeAt,
    dress_code: input.dressCode,
    expected_guests: input.expectedGuests,
    manager_employee_id: input.managerEmployeeId,
    staff_notes: input.staffNotes,
    updated_by: actor.source === 'supabase' ? actor.id : null,
    created_at: new Date().toISOString(),
  });
  return (await getBrief(db, eventId))!;
}
