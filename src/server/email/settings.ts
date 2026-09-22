import 'server-only';

import { EMAIL_SWITCHES, EMAIL_SWITCH_DEFAULTS, type EmailSwitchId } from '@/emails/registry';
import { getReadDb } from '@/lib/db';
import type { Db, Row } from '@/lib/db/types';

/**
 * Which optional emails are switched on.
 *
 * The registry says what may be switched and how it ships; `email_settings`
 * holds only the rows somebody has changed. Everything else falls back to
 * the shipped default, and so does a database that cannot be reached — a
 * failed read must never be the reason an email stops going out.
 *
 * This is deliberately not cached. It is read once per cron pass and once
 * per staff notice, both of which are rare, and a switch the owner has just
 * flipped should take effect on the next send rather than in five minutes.
 */

export type EmailSwitchState = Record<EmailSwitchId, boolean>;

function defaults(): EmailSwitchState {
  return { ...EMAIL_SWITCH_DEFAULTS };
}

function apply(rows: Row[]): EmailSwitchState {
  const state = defaults();
  for (const row of rows) {
    const id = String(row.template_id ?? '') as EmailSwitchId;
    if (id in state) state[id] = row.enabled === true;
  }
  return state;
}

/** Every switch, defaults merged with whatever the owner has changed. */
export async function emailSwitches(): Promise<EmailSwitchState> {
  try {
    const db = getReadDb();
    if (!db) return defaults();
    return apply(await db.list<Row>('email_settings'));
  } catch {
    // No table yet, no database, no permission: ship-default behaviour.
    return defaults();
  }
}

/** One switch. Same fallbacks as `emailSwitches`. */
export async function emailSwitchOn(id: EmailSwitchId): Promise<boolean> {
  const state = await emailSwitches();
  return state[id] ?? EMAIL_SWITCH_DEFAULTS[id] ?? true;
}

/**
 * Write one switch. Takes the write-side database from the caller so the
 * signed-in manager's session — and the row-level policy on the table —
 * applies, exactly like every other admin mutation.
 */
export async function setEmailSwitch(db: Db, id: EmailSwitchId, enabled: boolean, updatedBy: string | null): Promise<void> {
  await db.upsert('email_settings', {
    template_id: id,
    enabled,
    updated_at: new Date().toISOString(),
    ...(updatedBy ? { updated_by: updatedBy } : {}),
  });
}

/** The switches, in the order the admin shows them, with their current state. */
export async function emailSwitchList(): Promise<{ id: EmailSwitchId; on: boolean }[]> {
  const state = await emailSwitches();
  return EMAIL_SWITCHES.map((entry) => ({ id: entry.id, on: state[entry.id] ?? entry.defaultOn }));
}
