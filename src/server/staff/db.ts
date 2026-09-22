import 'server-only';

import { getReadDb, getWriteDb, isLocalDb } from '@/lib/db';
import { SupabaseDb } from '@/lib/db/supabase';
import type { Db } from '@/lib/db/types';
import { getServiceClient, isSupabaseConfigured } from '@/lib/supabase/server';

/**
 * Three database handles for the staff system, and when each is right.
 *
 *   opsReadDb()      reads, after the server has checked the capability. The
 *                    same elevated read every admin page already uses; the
 *                    domain functions filter to what the caller may see.
 *   opsWriteDb()     the signed-in person's own session. Row Level Security
 *                    and the column guards in migration 0022 apply, so a
 *                    write the screen does not offer is refused by Postgres
 *                    even if a server action forgot to check.
 *   opsElevatedDb()  the service role, for the few writes that must be done
 *                    on someone's behalf after the server has verified them:
 *                    grading a quiz (the answer key is manager-only), fanning
 *                    out notifications, writing the audit trail, creating an
 *                    employee's requirement rows. Named so a reviewer can
 *                    grep for every place RLS is bypassed.
 *
 * Locally all three are the same file-backed database.
 */

export function opsReadDb(): Db | null {
  return getReadDb();
}

export async function opsWriteDb(): Promise<Db | null> {
  return getWriteDb();
}

export function opsElevatedDb(): Db | null {
  if (isSupabaseConfigured()) {
    const client = getServiceClient();
    return client ? new SupabaseDb(client) : null;
  }
  return isLocalDb() ? getReadDb() : null;
}

export function opsConfigured(): boolean {
  return opsReadDb() !== null;
}
