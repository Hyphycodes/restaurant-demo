import 'server-only';

import type { SchedulePeriod, SchedulePeriodStatus } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import { addDays, startOfWeek, zonedInstant } from '@/lib/staff/time';
import type { Staff } from '@/server/auth';

/**
 * A week of the schedule, and whether it is out.
 *
 * A shift has its own status — 0022 — and that is still what decides whether
 * one person can see one shift. The week on top of it answers the other
 * question, the one an employee actually asks on a Sunday night: *is next
 * week up yet?* Without it, "no shifts" and "not finished" look identical,
 * and the honest answer to the second is not silence.
 *
 * No row means the week has never been touched, which reads as draft. The
 * row appears the moment a manager builds or publishes it.
 */

export function periodFromRow(row: Row): SchedulePeriod {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    weekStart: String(row.week_start).slice(0, 10),
    status: (row.status as SchedulePeriodStatus) ?? 'draft',
    publishedAt: (row.published_at as string | null) ?? null,
    notifiedAt: (row.notified_at as string | null) ?? null,
    note: (row.note as string | null) ?? null,
  };
}

/** The instants a local week covers at a location. */
export function weekBounds(weekStart: string, timezone: string): { from: string; to: string } {
  return { from: zonedInstant(weekStart, 0, timezone), to: zonedInstant(addDays(weekStart, 7), 0, timezone) };
}

export async function getPeriod(db: Db, locationId: string, weekStart: string): Promise<SchedulePeriod | null> {
  const rows = await db.list<Row>('schedule_periods', { where: { location_id: locationId, week_start: weekStart } });
  return rows[0] ? periodFromRow(rows[0]) : null;
}

/** Every period for a location in a date window, keyed by week start. */
export async function periodsBetween(db: Db, locationId: string, fromWeek: string, toWeek: string): Promise<Map<string, SchedulePeriod>> {
  const rows = await db.list<Row>('schedule_periods', {
    where: { location_id: locationId },
    range: { column: 'week_start', from: fromWeek, to: addDays(toWeek, 1) },
  });
  return new Map(rows.map((row) => [String(row.week_start).slice(0, 10), periodFromRow(row)]));
}

/** The status of a week, treating a missing row as a draft nobody has started. */
export function statusOf(period: SchedulePeriod | null): SchedulePeriodStatus {
  return period?.status ?? 'draft';
}

export function isLive(period: SchedulePeriod | null): boolean {
  return statusOf(period) === 'published';
}

/** Creates the row for a week if it is not there yet, so a draft can be recorded. */
export async function ensurePeriod(db: Db, locationId: string, weekStart: string): Promise<SchedulePeriod> {
  const existing = await getPeriod(db, locationId, weekStart);
  if (existing) return existing;
  const row = await db.insert<Row>('schedule_periods', {
    location_id: locationId,
    week_start: weekStart,
    status: 'draft',
    published_at: null,
    published_by: null,
    notified_at: null,
    note: null,
    created_at: new Date().toISOString(),
  });
  return periodFromRow(row);
}

export interface PublishResult {
  period: SchedulePeriod;
  /** Shifts that moved from draft to published in this call. */
  released: number;
  /** True the first time a week goes out — the only time everyone is told. */
  firstRelease: boolean;
}

/**
 * Releases a week.
 *
 * Two things happen and they are deliberately separate: every draft shift in
 * the window becomes published, and the week itself is marked live. The
 * second is what an employee's "next week is being prepared" message reads,
 * and what stops the fan-out running twice — `notified_at` is set once and
 * never cleared, so a manager who adds a shift on Thursday and publishes
 * again tells one person rather than fourteen.
 */
export async function publishPeriod(
  db: Db,
  locationId: string,
  weekStart: string,
  timezone: string,
  actor: Staff,
  publishShifts: (from: string, to: string) => Promise<number>,
): Promise<PublishResult> {
  const week = startOfWeek(weekStart);
  const { from, to } = weekBounds(week, timezone);
  const released = await publishShifts(from, to);
  const existing = await ensurePeriod(db, locationId, week);
  const firstRelease = existing.notifiedAt === null;
  const now = new Date().toISOString();
  const row = await db.update<Row>('schedule_periods', existing.id, {
    status: 'published',
    published_at: existing.publishedAt ?? now,
    published_by: actor.source === 'supabase' ? actor.id : null,
    notified_at: existing.notifiedAt ?? now,
  });
  return { period: periodFromRow(row), released, firstRelease };
}

/**
 * Which of an employee's weeks are live.
 *
 * Takes the location the person works at rather than every location, because
 * "is my schedule out" is a question about the place they work.
 */
export async function scheduleStatusFor(db: Db, locationId: string, weeks: string[]): Promise<Map<string, SchedulePeriodStatus>> {
  const sorted = [...weeks].sort();
  if (sorted.length === 0) return new Map();
  const periods = await periodsBetween(db, locationId, sorted[0]!, sorted[sorted.length - 1]!);
  return new Map(sorted.map((week) => [week, statusOf(periods.get(week) ?? null)]));
}
