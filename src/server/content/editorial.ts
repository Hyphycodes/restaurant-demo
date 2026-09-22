import 'server-only';

import type { EditorialState, VersionEntry } from '@/content/admin-types';
import type { Db, Row } from '@/lib/db/types';
import { replaceModifiers } from './modifiers';
import type { Staff } from '../auth';

/**
 * Drafts, publishing, versions and archiving — once, for every kind of record.
 *
 * The model is deliberately small. A row's ordinary columns are what the public
 * reads. `draft` holds unpublished edits and is never selected by a public query.
 * Publishing snapshots the live columns into `content_versions`, merges the draft
 * in, and clears it.
 *
 * That gives all five states the brief asks for out of two columns:
 *
 *   draft        the record is not public yet          published === false
 *   published    live, nothing pending                 draft is null
 *   changed      live, with edits waiting              draft is not null
 *   archived     off the website, history kept         archived_at is set
 *   scheduled    NOT IMPLEMENTED — see the note below
 *
 * Scheduling needs something to run at the appointed minute. This deployment has
 * no scheduler, and a "scheduled" state that silently never fires is worse than
 * not offering it, so it is absent rather than pretended. docs/ADMIN-GUIDE.md
 * records it as deferred.
 */

export type { EditorialState, VersionEntry };

export interface EditorialRow extends Row {
  draft?: Row | null;
  archived_at?: string | null;
  published?: boolean;
}

export function stateOf(row: EditorialRow): EditorialState {
  if (row.archived_at) return 'archived';
  if (row.published === false) return 'draft';
  if (row.draft && Object.keys(row.draft).length > 0) return 'changed';
  return 'published';
}

export const STATE_LABEL: Record<EditorialState, string> = {
  draft: 'Draft',
  published: 'Live',
  changed: 'Unpublished changes',
  archived: 'Off the website',
};

/** What a guest sees right now: the live columns, with the draft ignored. */
export function liveValues<T extends EditorialRow>(row: T): T {
  const { draft: _draft, ...live } = row;
  return live as T;
}

/** What the editor is working on: live values with their draft laid over the top. */
export function workingValues<T extends EditorialRow>(row: T): T {
  const { draft, ...live } = row;
  return { ...(live as T), ...((draft as Row) ?? {}) };
}

/** True when this field differs between what is live and what is drafted. */
export function isChanged(row: EditorialRow, field: string): boolean {
  if (!row.draft) return false;
  return field in row.draft && row.draft[field] !== row[field];
}

/* -------------------------------------------------------------------------- */

async function snapshot(db: Db, table: string, id: string, staff: Staff, label: string) {
  const row = await db.get<EditorialRow>(table, id);
  if (!row) return;
  await db.insert('content_versions', {
    id: crypto.randomUUID(),
    table_name: table,
    row_id: id,
    snapshot: liveValues(row),
    label,
    actor: staff.source === 'supabase' ? staff.id : null,
    actor_name: staff.name || staff.email,
    at: new Date().toISOString(),
  });
}

/**
 * Save without publishing. The live columns are untouched, so the website does
 * not change and no cache needs clearing.
 */
export async function saveDraft(
  db: Db,
  table: string,
  id: string,
  patch: Row,
  staff: Staff,
): Promise<void> {
  const row = await db.get<EditorialRow>(table, id);
  if (!row) throw new Error('That item no longer exists.');

  const merged = { ...((row.draft as Row) ?? {}), ...patch };

  // A draft identical to what is already live is not a draft, it is noise in the
  // dashboard's "waiting to be published" count.
  for (const [field, value] of Object.entries(merged)) {
    if (row[field] === value) delete merged[field];
  }

  await db.update(table, id, {
    draft: Object.keys(merged).length > 0 ? merged : null,
    updated_by: staff.source === 'supabase' ? staff.id : null,
  });
}

/** Publish whatever is waiting in the draft. */
export async function publishDraft(
  db: Db,
  table: string,
  id: string,
  staff: Staff,
): Promise<string[]> {
  const row = await db.get<EditorialRow>(table, id);
  if (!row) throw new Error('That item no longer exists.');

  const draft = { ...((row.draft as Row) ?? {}) };
  const fields = Object.keys(draft);
  if (fields.length === 0 && row.published !== false) return [];

  await snapshot(db, table, id, staff, 'Before publishing');
  if (table === 'menu_items' && Array.isArray(draft._modifiers)) {
    await replaceModifiers(db, id, draft._modifiers as Row[]);
    delete draft._modifiers;
  }
  await db.update(table, id, {
    ...draft,
    draft: null,
    published: true,
    updated_by: staff.source === 'supabase' ? staff.id : null,
  });
  return fields;
}

/**
 * Change the live values in one step.
 *
 * This is what a Manager does when they change a price mid-service: there is no
 * useful review step for "$16 is now $17", and forcing one would make the admin
 * slower than the paper menu it replaces.
 */
export async function publishDirect(
  db: Db,
  table: string,
  id: string,
  patch: Row,
  staff: Staff,
): Promise<void> {
  await snapshot(db, table, id, staff, 'Before change');
  patch = { ...patch };
  if (table === 'menu_items' && Array.isArray(patch._modifiers)) {
    await replaceModifiers(db, id, patch._modifiers as Row[]);
    delete patch._modifiers;
  }
  await db.update(table, id, {
    ...patch,
    draft: null,
    updated_by: staff.source === 'supabase' ? staff.id : null,
  });
}

export async function discardDraft(db: Db, table: string, id: string): Promise<void> {
  await db.update(table, id, { draft: null });
}

/** Off the website, history intact. Nothing is deleted and nothing cascades. */
export async function archive(db: Db, table: string, id: string, staff: Staff): Promise<void> {
  await snapshot(db, table, id, staff, 'Before archiving');
  await db.update(table, id, { archived_at: new Date().toISOString(), draft: null });
}

export async function unarchive(db: Db, table: string, id: string): Promise<void> {
  await db.update(table, id, { archived_at: null });
}

export async function listVersions(db: Db, table: string, id: string): Promise<VersionEntry[]> {
  const rows = await db.list<Row>('content_versions', {
    where: { table_name: table, row_id: id },
    orderBy: 'at',
    desc: true,
    limit: 20,
  });
  return rows.map((row) => ({
    id: String(row.id),
    at: String(row.at),
    label: String(row.label ?? ''),
    actorName: String(row.actor_name ?? ''),
    snapshot: (row.snapshot as Row) ?? {},
  }));
}

/**
 * Put an earlier version back — as a DRAFT, not straight onto the website.
 *
 * Restoring is an edit like any other and gets the same review step. It also
 * means a mistaken restore costs nothing: discard the draft.
 */
export async function restoreVersion(
  db: Db,
  table: string,
  id: string,
  versionId: string,
  staff: Staff,
): Promise<string[]> {
  const version = await db.get<Row>('content_versions', versionId);
  if (!version) throw new Error('That version is no longer available.');

  const current = await db.get<EditorialRow>(table, id);
  if (!current) throw new Error('That item no longer exists.');

  if (version.table_name !== table || version.row_id !== id) throw new Error('That version belongs to a different item.');
  const snap = (version.snapshot as Row) ?? {};
  const patch: Row = {};
  // Identity, ordering and bookkeeping columns are not content and must not be
  // dragged backwards by a restore.
  const skip = new Set(['id', 'slug', 'page', 'asset_id', 'user_id', 'draft', 'updated_at', 'updated_by', 'created_at', 'archived_at']);

  for (const [field, value] of Object.entries(snap)) {
    if (skip.has(field)) continue;
    if (current[field] !== value) patch[field] = value;
  }

  if (Object.keys(patch).length === 0) return [];
  await saveDraft(db, table, id, patch, staff);
  return Object.keys(patch);
}
