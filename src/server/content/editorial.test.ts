import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalDb } from '@/lib/db/local';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '../auth';
import {
  archive,
  discardDraft,
  isChanged,
  listVersions,
  liveValues,
  publishDirect,
  publishDraft,
  restoreVersion,
  saveDraft,
  stateOf,
  unarchive,
  workingValues,
  type EditorialRow,
} from './editorial';

/**
 * Editorial workflow, exercised against a real database.
 *
 * These run on the local file adapter, which is the same `Db` interface the
 * Supabase adapter implements and the same repository code production runs — so
 * "a draft never reaches a public read" is proved, not asserted in a comment.
 */

const staff: Staff = {
  id: 'test-manager',
  email: 'manager@example.invalid',
  name: 'Alex',
  role: 'admin',
  sections: [],
  active: true,
  source: 'local',
};

let dir: string;
let db: Db;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cosa-nostra-editorial-'));
  db = new LocalDb(dir, () => ({
    menu_items: [
      {
        id: 'whipped-ricotta',
        category_id: 'antipasti',
        name: 'Queso Dip',
        price_mode: 'fixed',
        price_cents: 900,
        price_note: null,
        availability: 'available',
        available: true,
        sort: 0,
        draft: null,
        archived_at: null,
      },
    ],
    content_versions: [],
  }));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const item = () => db.get<EditorialRow>('menu_items', 'whipped-ricotta') as Promise<EditorialRow>;

describe('drafts', () => {
  it('leave the live values untouched', async () => {
    await saveDraft(db, 'menu_items', 'whipped-ricotta', { price_cents: 1100 }, staff);
    const row = await item();

    expect(liveValues(row).price_cents).toBe(900);
    expect(workingValues(row).price_cents).toBe(1100);
    expect(stateOf(row)).toBe('changed');
    expect(isChanged(row, 'price_cents')).toBe(true);
  });

  it('accumulate across saves rather than replacing each other', async () => {
    await saveDraft(db, 'menu_items', 'whipped-ricotta', { price_cents: 1100 }, staff);
    await saveDraft(db, 'menu_items', 'whipped-ricotta', { name: 'Queso Fundido' }, staff);

    const working = workingValues(await item());
    expect(working.price_cents).toBe(1100);
    expect(working.name).toBe('Queso Fundido');
  });

  it('drop a field that has been edited back to what is already live', async () => {
    await saveDraft(db, 'menu_items', 'whipped-ricotta', { price_cents: 1100 }, staff);
    await saveDraft(db, 'menu_items', 'whipped-ricotta', { price_cents: 900 }, staff);

    const row = await item();
    // Otherwise the dashboard would report changes waiting that do not exist.
    expect(row.draft).toBeNull();
    expect(stateOf(row)).toBe('published');
  });

  it('can be discarded without touching the website', async () => {
    await saveDraft(db, 'menu_items', 'whipped-ricotta', { price_cents: 9900 }, staff);
    await discardDraft(db, 'menu_items', 'whipped-ricotta');

    const row = await item();
    expect(row.draft).toBeNull();
    expect(liveValues(row).price_cents).toBe(900);
  });
});

describe('publishing', () => {
  it('moves the draft onto the live row and clears it', async () => {
    await saveDraft(db, 'menu_items', 'whipped-ricotta', { price_cents: 1100 }, staff);
    const fields = await publishDraft(db, 'menu_items', 'whipped-ricotta', staff);

    const row = await item();
    expect(fields).toEqual(['price_cents']);
    expect(liveValues(row).price_cents).toBe(1100);
    expect(row.draft).toBeNull();
    expect(stateOf(row)).toBe('published');
  });

  it('is a no-op when nothing is waiting', async () => {
    expect(await publishDraft(db, 'menu_items', 'whipped-ricotta', staff)).toEqual([]);
  });

  it('records a version before it changes anything', async () => {
    await saveDraft(db, 'menu_items', 'whipped-ricotta', { price_cents: 1100 }, staff);
    await publishDraft(db, 'menu_items', 'whipped-ricotta', staff);

    const versions = await listVersions(db, 'menu_items', 'whipped-ricotta');
    expect(versions).toHaveLength(1);
    expect(versions[0]!.snapshot.price_cents).toBe(900);
    expect(versions[0]!.actorName).toBe('Alex');
  });

  it('a direct change also leaves a version behind', async () => {
    await publishDirect(db, 'menu_items', 'whipped-ricotta', { price_cents: 1000 }, staff);
    await publishDirect(db, 'menu_items', 'whipped-ricotta', { price_cents: 1200 }, staff);

    const versions = await listVersions(db, 'menu_items', 'whipped-ricotta');
    expect(versions.map((v) => v.snapshot.price_cents)).toEqual([1000, 900]);
  });

  it('a direct change clears any draft, so nothing is silently resurrected', async () => {
    await saveDraft(db, 'menu_items', 'whipped-ricotta', { name: 'Old draft name' }, staff);
    await publishDirect(db, 'menu_items', 'whipped-ricotta', { price_cents: 1000 }, staff);

    const row = await item();
    expect(row.draft).toBeNull();
    expect(liveValues(row).name).toBe('Queso Dip');
  });
});

describe('versions and restore', () => {
  it('restores as a draft, so the website does not change until it is published', async () => {
    await publishDirect(db, 'menu_items', 'whipped-ricotta', { price_cents: 1500 }, staff);
    const [version] = await listVersions(db, 'menu_items', 'whipped-ricotta');

    const restored = await restoreVersion(db, 'menu_items', 'whipped-ricotta', version!.id, staff);

    const row = await item();
    expect(restored).toContain('price_cents');
    expect(liveValues(row).price_cents).toBe(1500);
    expect(workingValues(row).price_cents).toBe(900);
    expect(stateOf(row)).toBe('changed');

    await publishDraft(db, 'menu_items', 'whipped-ricotta', staff);
    expect(liveValues(await item()).price_cents).toBe(900);
  });

  it('never drags identity or bookkeeping columns backwards', async () => {
    await publishDirect(db, 'menu_items', 'whipped-ricotta', { price_cents: 1500 }, staff);
    const [version] = await listVersions(db, 'menu_items', 'whipped-ricotta');
    const restored = await restoreVersion(db, 'menu_items', 'whipped-ricotta', version!.id, staff);

    for (const field of ['id', 'updated_at', 'updated_by', 'draft', 'archived_at']) {
      expect(restored).not.toContain(field);
    }
  });

  it('reports nothing to do when the version matches what is live', async () => {
    await publishDirect(db, 'menu_items', 'whipped-ricotta', { price_cents: 900 }, staff);
    const [version] = await listVersions(db, 'menu_items', 'whipped-ricotta');
    expect(await restoreVersion(db, 'menu_items', 'whipped-ricotta', version!.id, staff)).toEqual([]);
  });

  it('keeps the newest version first', async () => {
    await publishDirect(db, 'menu_items', 'whipped-ricotta', { price_cents: 1000 }, staff);
    await publishDirect(db, 'menu_items', 'whipped-ricotta', { price_cents: 1100 }, staff);
    await publishDirect(db, 'menu_items', 'whipped-ricotta', { price_cents: 1200 }, staff);

    const versions = await listVersions(db, 'menu_items', 'whipped-ricotta');
    const times = versions.map((v) => v.at);
    expect([...times].sort().reverse()).toEqual(times);
  });
});

describe('archiving', () => {
  it('takes the row off the website without deleting it', async () => {
    await archive(db, 'menu_items', 'whipped-ricotta', staff);

    const row = await item();
    expect(row).not.toBeNull();
    expect(stateOf(row)).toBe('archived');
    expect(row.archived_at).toBeTruthy();
  });

  it('is reversible, and the row comes back as it was', async () => {
    await archive(db, 'menu_items', 'whipped-ricotta', staff);
    await unarchive(db, 'menu_items', 'whipped-ricotta');

    const row = await item();
    expect(stateOf(row)).toBe('published');
    expect(liveValues(row).price_cents).toBe(900);
  });

  it('snapshots first, so an archive can be undone even after other edits', async () => {
    await archive(db, 'menu_items', 'whipped-ricotta', staff);
    const versions = await listVersions(db, 'menu_items', 'whipped-ricotta');
    expect(versions[0]!.label).toMatch(/archiv/i);
  });
});

describe('state labelling', () => {
  it('names each state from the row alone', () => {
    expect(stateOf({} as Row)).toBe('published');
    expect(stateOf({ draft: { name: 'x' } } as EditorialRow)).toBe('changed');
    expect(stateOf({ published: false } as EditorialRow)).toBe('draft');
    expect(stateOf({ archived_at: 'now' } as EditorialRow)).toBe('archived');
    // Archived wins: an archived record with a pending draft is still off the site.
    expect(stateOf({ archived_at: 'now', draft: { a: 1 } } as EditorialRow)).toBe('archived');
  });

  it('treats an empty draft object as no draft', () => {
    expect(stateOf({ draft: {} } as EditorialRow)).toBe('published');
  });
});
