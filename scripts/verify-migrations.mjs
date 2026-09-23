/**
 * Proves the Supabase migrations apply, in order, to a clean Postgres 17 —
 * then runs the repository's SQL security walkthroughs against the result.
 *
 *   npm run db:verify
 *
 * PGlite (Postgres compiled to WASM) stands in for the database; a small shim
 * provides what the Supabase platform supplies before any migration runs: the
 * anon/authenticated/service_role roles and their default grants, auth.users
 * and auth.uid(), and the storage schema. Nothing here touches a real project.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrations = path.join(root, 'supabase/migrations');
const tests = path.join(root, 'supabase/tests');

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage; create schema extensions;
  create table auth.users (instance_id uuid, id uuid primary key default gen_random_uuid(), aud text, role text, email text, encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb default '{}'::jsonb, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
  create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')) $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  -- Supabase's platform default: table privileges are granted, RLS decides.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
`);

const files = (await readdir(migrations)).filter((file) => file.endsWith('.sql')).sort();
for (const file of files) {
  try {
    await db.exec(await readFile(path.join(migrations, file), 'utf8'));
  } catch (error) {
    console.error(`✗ ${file}: ${error.message}`);
    process.exit(1);
  }
}
console.log(`✓ ${files.length} migrations applied in order`);

// The newest migration must be safe to run twice.
await db.exec(await readFile(path.join(migrations, files.at(-1)), 'utf8'));
console.log(`✓ ${files.at(-1)} re-applies cleanly`);

const one = async (sql) => (await db.query(sql)).rows[0];
const summary = {
  tables: (await one(`select count(*)::int n from pg_tables where schemaname = 'public'`)).n,
  withoutRls: (await db.query(`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`)).rows.map((row) => row.tablename),
  policies: (await one(`select count(*)::int n from pg_policies where schemaname in ('public', 'storage')`)).n,
  indexes: (await one(`select count(*)::int n from pg_indexes where schemaname = 'public'`)).n,
  foreignKeys: (await one(`select count(*)::int n from information_schema.table_constraints where constraint_schema = 'public' and constraint_type = 'FOREIGN KEY'`)).n,
  buckets: (await db.query(`select id from storage.buckets order by id`)).rows.map((row) => row.id),
};
console.log(`✓ ${summary.tables} tables, ${summary.policies} policies, ${summary.indexes} indexes, ${summary.foreignKeys} foreign keys; buckets: ${summary.buckets.join(', ')}`);
if (summary.withoutRls.length) {
  console.error(`✗ tables without row level security: ${summary.withoutRls.join(', ')}`);
  process.exit(1);
}
console.log('✓ row level security is enabled on every public table');

for (const file of (await readdir(tests)).filter((name) => name.endsWith('.sql')).sort()) {
  try {
    await db.exec(await readFile(path.join(tests, file), 'utf8'));
    console.log(`✓ ${file}`);
  } catch (error) {
    console.error(`✗ ${file}: ${error.message}`);
    process.exit(1);
  }
}
