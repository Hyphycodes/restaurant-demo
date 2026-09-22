/** Generate an idempotent SQL seed from the same records the app imports. */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PRIMARY_KEY } from '../src/lib/db/types';
import { buildRecords, type Tables } from '../src/server/migration/records';

const ROOT = path.resolve(import.meta.dirname, '..');
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
  'locations',
  'positions',
  'requirement_types',
  // `job_openings` is deliberately NOT here. This file upserts, and `active`
  // on an opening is operational state the owner sets from the admin — a
  // re-run would switch their live roles back off. Migration 0026 inserts the
  // same nine rows with `on conflict do nothing`, which is the right
  // behaviour for a table somebody edits.
];

const JSONB_COLUMNS = new Set(['payload', 'ranges', 'items', 'config']);
const TEXT_ARRAY_COLUMNS = new Set(['dietary', 'music_formats', 'includes', 'tags', 'applies_to_positions']);
// Postgres will not implicitly cast text[] into a uuid[] column, and an empty
// array is exactly where that bites: `'{}'::text[]` fails on applies_to_locations.
const UUID_ARRAY_COLUMNS = new Set(['applies_to_locations']);
const OMIT_COLUMNS = new Set(['draft', 'archived_at', 'updated_by']);

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sql(column: string, value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (JSONB_COLUMNS.has(column) || (typeof value === 'object' && !Array.isArray(value))) {
    return `${quote(JSON.stringify(value))}::jsonb`;
  }
  if (TEXT_ARRAY_COLUMNS.has(column) || UUID_ARRAY_COLUMNS.has(column)) {
    const type = UUID_ARRAY_COLUMNS.has(column) ? 'uuid' : 'text';
    const values = value as unknown[];
    return values.length
      ? `array[${values.map((entry) => quote(String(entry))).join(', ')}]::${type}[]`
      : `'{}'::${type}[]`;
  }
  return quote(String(value));
}

async function main() {
  const { tables, report } = buildRecords();
  if (report.invalid.length) {
    throw new Error(`Cannot seed invalid content:\n${report.invalid.join('\n')}`);
  }

  const lines = [
    '-- GENERATED FILE — do not edit by hand.',
    '-- Produced by `npm run content:seed` from src/server/migration/records.ts.',
    '-- The SQL and API migration consume the same canonical mapping.',
    '',
    'begin;',
    '',
  ];

  for (const table of ORDER) {
    const rows = (tables as Tables)[table] ?? [];
    if (!rows.length) continue;
    lines.push(`-- ${table}`);
    const primaryKey = PRIMARY_KEY[table] ?? 'id';
    for (const row of rows) {
      const entries = Object.entries(row).filter(([column]) => !OMIT_COLUMNS.has(column));
      const columns = entries.map(([column]) => column);
      const updates = columns
        .filter((column) => column !== primaryKey && column !== 'created_at')
        .map((column) => `${column} = excluded.${column}`)
        .join(', ');
      lines.push(
        `insert into public.${table} (${columns.join(', ')})`,
        `  values (${entries.map(([column, value]) => sql(column, value)).join(', ')})`,
        `  on conflict (${primaryKey}) do update set ${updates};`,
      );
    }
    lines.push('');
  }

  lines.push('commit;', '');
  await writeFile(path.join(ROOT, 'supabase', 'seed.sql'), lines.join('\n'));
  console.log('Wrote supabase/seed.sql from the canonical migration mapping.');
  for (const table of ORDER) {
    console.log(`  ${table.padEnd(20)} ${(tables[table] ?? []).length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
