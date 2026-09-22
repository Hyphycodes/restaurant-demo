import 'server-only';
import { DEMO_MODE } from '@/lib/demo';
import { DemoDb } from './demo';
const demoDb = new DemoDb();

import { isAdminOpen } from '@/server/admin-access';
import { buildRecords } from '@/server/migration/records';
import { buildStaffDemo } from '@/server/staff/demo';
import { getServiceClient, getSessionClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { LocalDb } from './local';
import { SupabaseDb } from './supabase';
import type { Db } from './types';

/**
 * Which database answers, and under whose authority.
 *
 * Two axes, kept separate on purpose:
 *
 *   adapter    Supabase when it is configured; otherwise the local development
 *              file, which is REFUSED in production.
 *   authority  a session-scoped client for anything a signed-in staff member
 *              does, so Row Level Security and the publish trigger apply; a
 *              service client only for reading published content during SSR.
 *
 * Getting the second one wrong is how an admin write ends up bypassing RLS, so
 * there are two named functions rather than one with a boolean.
 */

let local: LocalDb | null = null;

function localDb(): LocalDb {
  // The local file is development-only (refused in production, below), which
  // is the one place the staff demo — an owner, a manager, a bartender, a
  // schedule — is seeded without being asked. Supabase never gets it unless
  // `scripts/seed-staff-demo.ts` is run on purpose.
  local ??= new LocalDb(undefined, () => ({ ...buildRecords().tables, ...buildStaffDemo() }));
  return local;
}

/**
 * True when the site is running on the local development database.
 *
 * The admin surfaces this, because "my changes did not stick" is a much worse
 * discovery than a banner saying where the data lives.
 */
export function isLocalDb(): boolean {
  return DEMO_MODE || !isSupabaseConfigured() && process.env.NODE_ENV !== 'production';
}

/** Read-side database for published public content. Never used for admin writes. */
export function getReadDb(): Db | null {
  if (DEMO_MODE) return local ?? demoDb;
  if (isSupabaseConfigured()) {
    const client = getServiceClient();
    return client ? new SupabaseDb(client) : null;
  }
  // In production with no Supabase, there is no database at all: `resolve.ts`
  // serves the typed static content, which is the documented fallback.
  return isLocalDb() ? localDb() : null;
}

/**
 * Write-side database, carrying the signed-in staff member's session.
 *
 * Returns null when there is nowhere safe to write — production without Supabase
 * — so callers fail closed rather than silently writing somewhere unexpected.
 *
 * WHILE THE ADMIN IS OPEN there is no session to carry, so writes use the
 * service client instead. That bypasses Row Level Security, which is the honest
 * consequence of turning the gate off: with no account there is no role for the
 * database to check. Turn sign-in back on (src/server/admin-access.ts) and every
 * write goes back through the signed-in user's session, RLS and the publish
 * guard — none of which has been removed.
 */
export async function getWriteDb(): Promise<Db | null> {
  if (DEMO_MODE) return local ?? demoDb;
  if (isSupabaseConfigured()) {
    const client = isAdminOpen() ? getServiceClient() : await getSessionClient();
    return client ? new SupabaseDb(client) : null;
  }
  return isLocalDb() ? localDb() : null;
}

/** Test seam: swap in a throwaway local database. */
export function __setLocalDbForTests(db: LocalDb | null): void {
  local = db;
}
