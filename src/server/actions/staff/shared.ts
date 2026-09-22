import 'server-only';

import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/content/admin-types';
import type { Db } from '@/lib/db/types';
import { friendly } from '@/server/actions/shared';
import { opsElevatedDb, opsWriteDb } from '@/server/staff/db';
import type { OpsCapability } from '@/server/staff/permissions';
import { requireOps, type StaffContext } from '@/server/staff/session';

/**
 * The harness every staff mutation runs through. Same shape as the admin's
 * `run()`: the capability is checked before a database handle exists, a
 * thrown error becomes a sentence, and the staff routes are revalidated.
 *
 *   db        the signed-in person's session: RLS and the column guards apply
 *   elevated  the service role, for the handful of writes the server does on
 *             someone's behalf after checking (grading, notifications, audit)
 */
export type { ActionState };

export interface OpsContext {
  db: Db;
  elevated: Db;
  context: StaffContext;
}

export async function runOps(capability: OpsCapability, job: (ops: OpsContext) => Promise<ActionState>): Promise<ActionState> {
  try {
    const context = await requireOps(capability);
    const db = await opsWriteDb();
    const elevated = opsElevatedDb();
    if (!db || !elevated) {
      return { ok: false, message: 'The staff system is not connected, so nothing can be saved yet. A developer needs to finish the setup in docs/ENVIRONMENT.md.' };
    }
    return await job({ db, elevated, context });
  } catch (error) {
    return { ok: false, message: friendlyOps(error) };
  }
}

function friendlyOps(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/shifts_duration/i.test(raw)) return 'The shift has to end after it starts.';
  if (/time_off_range/i.test(raw)) return 'The last day has to be on or after the first.';
  if (/employees_email_idx|duplicate key.*employees/i.test(raw)) return 'Someone with that email is already on the team.';
  if (/not yours|only a manager|cannot approve your own|You can only/i.test(raw)) return raw;
  return friendly(error);
}

/** Saved. Refreshes the staff app (and the admin, which shows staffing on events). */
export function savedOps(message: string, extra: string[] = []): ActionState {
  revalidatePath('/staff', 'layout');
  for (const route of extra) revalidatePath(route);
  return { ok: true, message };
}

export function fail(message: string, errors?: Record<string, string>): ActionState {
  return { ok: false, message, errors };
}

/* --------------------------------------------------------- form helpers */

export function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function optional(form: FormData, key: string): string | null {
  const value = text(form, key);
  return value ? value : null;
}

export function bool(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === 'true' || value === 'on' || value === '1';
}

export function list(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : []))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function integer(form: FormData, key: string): number | null {
  const value = text(form, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

/** Dollars typed by a person → integer cents. "150" and "150.00" both work. */
export function cents(form: FormData, key: string): number | null {
  const value = text(form, key).replace(/[$,]/g, '');
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

export function isoDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
