import 'server-only';

import type { AvailabilityException, AvailabilityRule } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';

/**
 * Availability belongs to the employee. A manager reads it while scheduling
 * and is warned by it; nothing here lets a manager write it, and the RLS
 * policy in 0022 says the same.
 */

export function ruleFromRow(row: Row): AvailabilityRule {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    weekday: Number(row.weekday),
    available: row.available !== false,
    startMinutes: (row.start_minutes as number | null) ?? null,
    endMinutes: (row.end_minutes as number | null) ?? null,
    note: (row.note as string | null) ?? null,
  };
}

export function exceptionFromRow(row: Row): AvailabilityException {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    onDate: String(row.on_date),
    available: row.available === true,
    startMinutes: (row.start_minutes as number | null) ?? null,
    endMinutes: (row.end_minutes as number | null) ?? null,
    note: (row.note as string | null) ?? null,
  };
}

export async function listAvailabilityFor(db: Db, employeeId: string): Promise<{ rules: AvailabilityRule[]; exceptions: AvailabilityException[] }> {
  const [rules, exceptions] = await Promise.all([
    db.list<Row>('availability_rules', { where: { employee_id: employeeId }, orderBy: 'weekday' }),
    db.list<Row>('availability_exceptions', { where: { employee_id: employeeId }, orderBy: 'on_date' }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return {
    rules: rules.map(ruleFromRow),
    exceptions: exceptions.map(exceptionFromRow).filter((entry) => entry.onDate >= today),
  };
}

export interface WeekdayAvailabilityInput {
  weekday: number;
  available: boolean;
  startMinutes: number | null;
  endMinutes: number | null;
  note: string | null;
}

/** Replaces the whole weekly pattern. Seven rows in, seven rows stored. */
export async function saveWeeklyAvailability(db: Db, employeeId: string, week: WeekdayAvailabilityInput[]): Promise<void> {
  const existing = await db.list<Row>('availability_rules', { where: { employee_id: employeeId } });
  for (const day of week) {
    const current = existing.find((row) => Number(row.weekday) === day.weekday);
    const patch = {
      employee_id: employeeId,
      weekday: day.weekday,
      available: day.available,
      start_minutes: day.available ? day.startMinutes : null,
      end_minutes: day.available ? day.endMinutes : null,
      note: day.note,
    };
    if (current) await db.update('availability_rules', String(current.id), patch);
    else await db.insert('availability_rules', patch);
  }
}

export async function addAvailabilityException(db: Db, employeeId: string, input: { onDate: string; available: boolean; startMinutes: number | null; endMinutes: number | null; note: string | null }): Promise<void> {
  const existing = await db.list<Row>('availability_exceptions', { where: { employee_id: employeeId, on_date: input.onDate } });
  const patch = {
    employee_id: employeeId,
    on_date: input.onDate,
    available: input.available,
    start_minutes: input.available ? input.startMinutes : null,
    end_minutes: input.available ? input.endMinutes : null,
    note: input.note,
  };
  const current = existing[0];
  if (current) await db.update('availability_exceptions', String(current.id), patch);
  else await db.insert('availability_exceptions', { ...patch, created_at: new Date().toISOString() });
}

export async function removeAvailabilityException(db: Db, employeeId: string, id: string): Promise<void> {
  const row = await db.get<Row>('availability_exceptions', id);
  if (!row || row.employee_id !== employeeId) throw new Error('That is not yours to change.');
  await db.remove('availability_exceptions', id);
}

/** "Monday unavailable · Tuesday after 4 PM" — for a profile card. */
export function describeRule(rule: AvailabilityRule): string {
  if (!rule.available) return 'Unavailable';
  const clock = (minutes: number) => {
    const hour = Math.floor(minutes / 60) % 24;
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const minute = minutes % 60;
    return `${h12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour < 12 ? 'AM' : 'PM'}`;
  };
  if (rule.startMinutes === null && rule.endMinutes === null) return 'All day';
  if (rule.startMinutes !== null && rule.endMinutes === null) return `After ${clock(rule.startMinutes)}`;
  if (rule.startMinutes === null && rule.endMinutes !== null) return `Until ${clock(rule.endMinutes)}`;
  return `${clock(rule.startMinutes!)} – ${clock(rule.endMinutes!)}`;
}
