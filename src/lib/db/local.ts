import 'server-only';

import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Db, ListOptions, Row } from './types';
import { primaryKey } from './types';

/**
 * File-backed development and test database.
 *
 * WHY THIS EXISTS: the admin is only meaningful if you can actually operate it.
 * Without this, `git clone && npm install && npm run dev` gives you a sign-in
 * screen that cannot authenticate, and every workflow — drafts, publishing,
 * versions, reference protection — is untestable without provisioning a hosted
 * Postgres. This adapter makes all of it real locally, and it is what the
 * integration tests run against, so those tests exercise the same repository code
 * that production runs.
 *
 * WHAT IT IS NOT: a second source of truth. It is refused outright in production
 * (see src/lib/db/index.ts), it is git-ignored, and it is seeded from exactly the
 * same typed static content that generates supabase/seed.sql.
 *
 * Writes are serialised through one in-process promise chain and land via
 * write-to-temp-then-rename, so an interrupted write cannot leave a half-written
 * file behind. That is enough for one dev server; it is not a claim of
 * multi-process safety, which is why it never runs in production.
 */

type Tables = Record<string, Row[]>;

const DEFAULT_DIR = path.join(process.cwd(), '.cosa-nostra-local');
const FILE = 'content.json';

export class LocalDb implements Db {
  readonly kind = 'local' as const;

  private cache: Tables | null = null;
  /**
   * Modification time of the file the cache was read from.
   *
   * Next.js gives the page render and the server actions their own module
   * instances in development, so each holds its own LocalDb and its own cached
   * copy of this file. Without this check, a photo swapped by an action was
   * written to disk, and the page that rendered next kept serving the copy it
   * had read at startup — the change was real and invisible, which is the worst
   * of both. Re-reading when the file has moved on costs one stat per query.
   */
  private cachedMtimeMs = 0;
  private queue: Promise<unknown> = Promise.resolve();
  /** In-flight first load, shared so concurrent requests do not each seed. */
  private loading: Promise<Tables> | null = null;
  private writes = 0;

  constructor(
    private readonly dir: string = DEFAULT_DIR,
    /** Seed applied the first time the file is created. */
    private readonly seed: () => Tables = () => ({}),
  ) {}

  private get file() {
    return path.join(this.dir, FILE);
  }

  /**
   * Reads the file, seeding it the first time.
   *
   * The in-flight promise is shared. A page that issues six content queries in
   * parallel would otherwise seed six times over, and six writers racing on one
   * filename is how the first version produced ENOENT on rename.
   */
  private async load(): Promise<Tables> {
    if (this.cache && !(await this.changedOnDisk())) return this.cache;
    this.loading ??= (async () => {
      try {
        const raw = await readFile(this.file, 'utf8');
        this.cache = JSON.parse(raw) as Tables;
        this.cachedMtimeMs = (await stat(this.file)).mtimeMs;
        // A local database may predate a newly added migration. Add only tables
        // that do not exist yet; never replace or merge rows in a table staff
        // has already edited.
        const fresh = this.seed();
        let upgraded = false;
        for (const [table, rows] of Object.entries(fresh)) {
          if (!(table in this.cache)) {
            this.cache[table] = rows;
            upgraded = true;
          }
        }
        if (upgraded) await this.flush();
      } catch {
        this.cache = this.seed();
        await this.flush();
      }
      return this.cache!;
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  /** True when another module instance, or another process, has written since. */
  private async changedOnDisk(): Promise<boolean> {
    try {
      return (await stat(this.file)).mtimeMs !== this.cachedMtimeMs;
    } catch {
      // No file: whatever is in memory is as good as it gets.
      return false;
    }
  }

  /**
   * Write to a uniquely-named temp file, then rename over the target.
   *
   * The rename is what makes it atomic: a reader either sees the whole previous
   * file or the whole new one, never a half-written JSON document. The name has
   * to be unique per write, not per process, or two writes in the same process
   * fight over the same temp path.
   */
  private async flush(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const temp = `${this.file}.${process.pid}.${(this.writes += 1)}.${crypto.randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(this.cache, null, 2), 'utf8');
    await rename(temp, this.file);
    // Record what we just wrote, so our own write does not read back as somebody
    // else's change on the next query.
    this.cachedMtimeMs = (await stat(this.file)).mtimeMs;
  }

  /** Serialises every mutation so two concurrent requests cannot interleave. */
  private write<T>(job: (tables: Tables) => Promise<T> | T): Promise<T> {
    const next = this.queue.then(async () => {
      const tables = await this.load();
      const result = await job(tables);
      await this.flush();
      return result;
    });
    // Keep the chain alive even if one job rejects.
    this.queue = next.catch(() => undefined);
    return next;
  }

  async list<T extends Row>(table: string, options: ListOptions = {}): Promise<T[]> {
    const tables = await this.load();
    let rows = [...((tables[table] ?? []) as T[])];

    for (const [column, value] of Object.entries(options.where ?? {})) {
      rows = rows.filter((row) => (value === null ? row[column] == null : row[column] === value));
    }
    for (const [column, values] of Object.entries(options.whereIn ?? {})) {
      const set = new Set<unknown>(values);
      rows = rows.filter((row) => set.has(row[column]));
    }
    if (options.range) {
      const { column, from, to } = options.range;
      rows = rows.filter((row) => {
        const value = row[column];
        if (value == null) return false;
        const text = String(value);
        return (from === undefined || text >= from) && (to === undefined || text < to);
      });
    }

    if (options.orderBy) {
      const key = options.orderBy;
      rows.sort((a, b) => {
        const left = a[key];
        const right = b[key];
        if (left === right) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        return left < right ? -1 : 1;
      });
      if (options.desc) rows.reverse();
    }

    return typeof options.limit === 'number' ? rows.slice(0, options.limit) : rows;
  }

  async get<T extends Row>(table: string, id: string): Promise<T | null> {
    const tables = await this.load();
    const key = primaryKey(table);
    return ((tables[table] ?? []).find((row) => row[key] === id) as T | undefined) ?? null;
  }

  insert<T extends Row>(table: string, row: Row): Promise<T> {
    return this.write((tables) => {
      const key = primaryKey(table);
      const rows = (tables[table] ??= []);
      const id = row[key] ?? crypto.randomUUID();
      if (rows.some((existing) => existing[key] === id)) {
        throw new Error(`${table}: "${String(id)}" already exists.`);
      }
      const stamped = { ...row, [key]: id, updated_at: new Date().toISOString() } as unknown as T;
      rows.push(stamped);
      return stamped;
    });
  }

  update<T extends Row>(table: string, id: string, patch: Row): Promise<T> {
    return this.write((tables) => {
      const key = primaryKey(table);
      const rows = (tables[table] ??= []);
      const index = rows.findIndex((row) => row[key] === id);
      if (index === -1) throw new Error(`${table}: "${id}" was not found.`);
      const updated = { ...rows[index], ...patch, updated_at: new Date().toISOString() } as unknown as T;
      rows[index] = updated;
      return updated;
    });
  }

  upsert<T extends Row>(table: string, row: Row): Promise<T> {
    return this.write((tables) => {
      const key = primaryKey(table);
      const rows = (tables[table] ??= []);
      const id = String(row[key]);
      const index = rows.findIndex((existing) => existing[key] === id);
      const stamped = {
        ...(index === -1 ? {} : rows[index]),
        ...row,
        updated_at: new Date().toISOString(),
      } as unknown as T;
      if (index === -1) rows.push(stamped);
      else rows[index] = stamped;
      return stamped;
    });
  }

  remove(table: string, id: string): Promise<void> {
    return this.write((tables) => {
      const key = primaryKey(table);
      const rows = (tables[table] ??= []);
      const index = rows.findIndex((row) => row[key] === id);
      if (index !== -1) rows.splice(index, 1);
    });
  }

  /** Test helper: drop everything and re-seed. Never called by application code. */
  async reset(): Promise<void> {
    await this.write((tables) => {
      for (const key of Object.keys(tables)) delete tables[key];
      Object.assign(tables, this.seed());
    });
  }
}
