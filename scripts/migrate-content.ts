import { DEMO_MODE } from '../src/lib/demo';


import { createClient } from '@supabase/supabase-js';
import { buildRecords, type Tables } from '../src/server/migration/records';
import { PRIMARY_KEY } from '../src/lib/db/types';

/** Insert order matters: a child row cannot reference a parent that is not there. */
const ORDER = [
  'site_settings',
  'announcements',
  'special_hours',
  'media_assets',
  'menus',
  'menu_categories',
  'menu_items',
  'menu_modifiers',
  'event_series',
  'event_occurrences',
  'catering_packages',
  'catering_items',
  'page_sections',
  'page_seo',
  'page_lists',
  'site_themes',
  // Staff reference data (migration 0022 inserts the same rows; these ids match,
  // so running both updates rather than duplicating).
  'locations',
  'positions',
  'requirement_types',
];

async function main() {
  if (DEMO_MODE) throw new Error('External database commands are disabled in this portfolio demo.');
  const write = process.argv.includes('--write');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const { tables, report } = buildRecords();

  console.log(`\nContent migration — ${write ? 'WRITING' : 'dry run'}\n`);
  console.log('Records to import');
  for (const table of ORDER) {
    const rows = (tables as Tables)[table] ?? [];
    console.log(`  ${table.padEnd(20)} ${String(rows.length).padStart(4)}`);
  }

  if (report.transformed.length) {
    console.log(`\nTransformed (${report.transformed.length}):`);
    for (const line of report.transformed.slice(0, 10)) console.log(`  · ${line}`);
    if (report.transformed.length > 10) console.log(`  … and ${report.transformed.length - 10} more`);
  }
  if (report.skipped.length) {
    console.log(`\nSkipped (${report.skipped.length}):`);
    for (const line of report.skipped) console.log(`  · ${line}`);
  }
  if (report.invalid.length) {
    console.error(`\nInvalid (${report.invalid.length}) — these will NOT be imported:`);
    for (const line of report.invalid) console.error(`  ✗ ${line}`);
  }

  if (!write) {
    console.log('\nNothing was written. Re-run with --write to apply.\n');
    return;
  }

  if (!url || !key) {
    console.error(
      '\nNEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set to write.\n' +
        'See docs/ENVIRONMENT.md. The service key bypasses Row Level Security, which is why this\n' +
        'is a command you run deliberately rather than something the app does.\n',
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let written = 0;
  const failures: string[] = [];

  for (const table of ORDER) {
    const rows = (tables as Tables)[table] ?? [];
    if (rows.length === 0) continue;

    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: PRIMARY_KEY[table] ?? 'id' });

    if (error) {
      failures.push(`${table}: ${error.message}`);
      console.error(`  ✗ ${table} — ${error.message}`);
    } else {
      written += rows.length;
      console.log(`  ✓ ${table} — ${rows.length}`);
    }
  }

  console.log(`\n${written} rows written.`);

  if (failures.length) {
    console.error(`\n${failures.length} table(s) failed. Nothing was rolled back — fix and re-run;`);
    console.error('the import is idempotent, so a second run is safe.\n');
    process.exit(1);
  }

  // Read back and compare, so "it said it worked" is not the only evidence.
  console.log('\nVerifying counts…');
  let mismatch = false;
  for (const table of ORDER) {
    const expected = ((tables as Tables)[table] ?? []).length;
    if (expected === 0) continue;
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`  ✗ ${table} — could not verify: ${error.message}`);
      mismatch = true;
      continue;
    }
    const ok = (count ?? 0) >= expected;
    if (!ok) mismatch = true;
    console.log(`  ${ok ? '✓' : '✗'} ${table.padEnd(20)} expected ≥ ${expected}, found ${count}`);
  }

  console.log(mismatch ? '\nCounts do not agree. Investigate before cutting over.\n' : '\nDone.\n');
  if (mismatch) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
