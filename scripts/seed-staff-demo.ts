import { DEMO_MODE } from '../src/lib/demo';
/**
 * The staff operations demo: an owner, a manager, a bartender, a server, a
 * door person, a new hire, two contractors, a week of shifts, training,
 * certifications, tasks, an announcement and a staffed event.
 *
 *   npx tsx scripts/seed-staff-demo.ts                   → the local dev database
 *   npx tsx scripts/seed-staff-demo.ts --to-supabase     → Supabase (needs
 *                                                          NEXT_PUBLIC_SUPABASE_URL
 *                                                          and SUPABASE_SERVICE_ROLE_KEY)
 *
 * It REFUSES a Supabase target unless the flag is given, and refuses outright
 * when NODE_ENV is production: demo people must never appear in the real
 * team directory by accident. Rows are keyed by fixed ids, so running it
 * twice updates rather than duplicates. Nothing is deleted.
 *
 * Against Supabase the demo employees are written WITHOUT auth users
 * (user_id null). Link a real sign-in by adding the employee from the staff
 * app instead, or set user_id by hand for one of these rows.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { buildStaffDemo, STAFF_DEMO_ORDER } from '../src/server/staff/demo';

async function main() {
  if (DEMO_MODE) throw new Error('External database commands are disabled in this portfolio demo.');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo staff data in production.');
  }
  const toSupabase = process.argv.includes('--to-supabase');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (toSupabase) {
    if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to seed Supabase.');
    const client = createClient(url, key, { auth: { persistSession: false } });
    const tables = buildStaffDemo(new Date(), { userIds: false });
    for (const table of STAFF_DEMO_ORDER) {
      const rows = tables[table] ?? [];
      if (rows.length === 0) continue;
      const conflict = table === 'training_answer_keys' ? 'question_id' : 'id';
      // shift_history uses a bigserial id: let Postgres assign it.
      const payload = table === 'shift_history' ? rows.map(({ id: _id, ...rest }) => rest) : rows;
      const { error } = await client.from(table).upsert(payload, { onConflict: conflict });
      if (error) throw new Error(`${table}: ${error.message}`);
      console.log(`${table}: ${rows.length} rows`);
    }
    console.log('Demo staff data written to Supabase. Demo employees have no sign-in; link one from the staff app.');
    return;
  }

  const dir = path.join(process.cwd(), '.casa-aurelia-local');
  const file = path.join(dir, 'content.json');
  await mkdir(dir, { recursive: true });
  let tables: Record<string, unknown[]> = {};
  try {
    tables = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown[]>;
  } catch {
    tables = {};
  }
  Object.assign(tables, buildStaffDemo());
  await writeFile(file, JSON.stringify(tables, null, 2), 'utf8');
  console.log(`Demo staff data written to ${file}. Sign in as Carlos (Bartender) at /admin/login?next=/staff.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
