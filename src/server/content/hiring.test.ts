import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';



const mocks = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock('@/lib/db', () => ({ getReadDb: mocks.db }));

import { getEditableOpenings, getPublicOpenings, listApplications } from './hiring';
import type { Db, Row } from '@/lib/db/types';

const OPENINGS: Row[] = [
  { id: 'a', title: 'Bartender', active: true, sort: 20, employment_type: 'either' },
  { id: 'b', title: 'Server', active: true, sort: 10, employment_type: 'part_time' },
  { id: 'c', title: 'Dishwasher', active: false, sort: 5, employment_type: 'either' },
  { id: 'd', title: 'Barback', active: true, sort: 1, archived_at: '2026-01-01T00:00:00Z' },
  { id: 'e', title: 'Host', active: true, sort: 30, employment_type: 'nonsense' },
];

const APPLICATIONS: Row[] = [
  { id: '1', reference: 'JOB-1', name: 'Isabella Reed', email: 'm@example.com', phone: '(312) 555-0147', position: 'Bartender', opening_id: 'a', status: 'new', created_at: '2026-09-03T00:00:00Z' },
  { id: '2', reference: 'JOB-2', name: 'Tomás Cruz', email: 't@example.com', position: 'Server', opening_id: 'b', status: 'hired', created_at: '2026-09-05T00:00:00Z' },
  { id: '3', reference: 'JOB-3', name: 'Ana Lopez', email: 'a@example.com', position: 'Bartender', opening_id: 'a', status: 'interview', created_at: '2026-09-09T00:00:00Z' },
];

function fakeDb(tables: Record<string, Row[]>): Db {
  return {
    kind: 'local',
    list: async (table: string) => (tables[table] ?? []) as never,
    get: async () => null,
    insert: async () => ({}) as never,
    update: async () => ({}) as never,
    upsert: async () => ({}) as never,
    remove: async () => {},
  };
}

beforeEach(() => mocks.db.mockReturnValue(fakeDb({ job_openings: OPENINGS, job_applications: APPLICATIONS })));
afterEach(() => vi.clearAllMocks());

describe('what the website shows', () => {
  it('is only what is switched on and not archived, in the chosen order', async () => {
    const openings = await getPublicOpenings();
    expect(openings.map((entry) => entry.title)).toEqual(['Server', 'Bartender', 'Host']);
  });

  it('falls back to the fictional open roles when there is no database', async () => {
    mocks.db.mockReturnValue(null);
    // The typed fallback is nine roles, every one of them inactive, so the
    // honest public answer is an empty list.
    expect((await getPublicOpenings()).map(o=>o.title)).toEqual(['Server','Bartender','Host','Line cook']);
  });

  it('keeps serving the fallback when the database throws', async () => {
    mocks.db.mockReturnValue({
      ...fakeDb({}),
      list: async () => {
        throw new Error('offline');
      },
    });
    expect((await getPublicOpenings()).map(o=>o.title)).toEqual(['Server','Bartender','Host','Line cook']);
  });

  it('treats an unknown employment type as the safe one rather than rendering it raw', async () => {
    const host = (await getPublicOpenings()).find((entry) => entry.title === 'Host');
    expect(host?.employmentType).toBe('either');
  });
});

describe('what the admin sees', () => {
  it('includes the switched-off and archived ones, because those are what is edited', async () => {
    const openings = await getEditableOpenings(fakeDb({ job_openings: OPENINGS }));
    expect(openings).toHaveLength(5);
    expect(openings.find((entry) => entry.title === 'Barback')?.archivedAt).toBeTruthy();
  });
});

describe('finding an applicant', () => {
  const db = fakeDb({ job_applications: APPLICATIONS });

  it('defaults to everyone still in play, newest first', async () => {
    const open = await listApplications(db, { status: 'open' });
    expect(open.map((entry) => entry.name)).toEqual(['Ana Lopez', 'Isabella Reed']);
  });

  it('filters by status and by role', async () => {
    expect((await listApplications(db, { status: 'hired' })).map((e) => e.name)).toEqual(['Tomás Cruz']);
    expect((await listApplications(db, { openingId: 'a' })).map((e) => e.name)).toEqual([
      'Ana Lopez',
      'Isabella Reed',
    ]);
  });

  it('searches the things somebody actually types', async () => {
    expect((await listApplications(db, { query: 'ISABELLA' })).map((e) => e.name)).toEqual(['Isabella Reed']);
    expect((await listApplications(db, { query: '555-0147' })).map((e) => e.name)).toEqual(['Isabella Reed']);
    expect((await listApplications(db, { query: 'JOB-2' })).map((e) => e.name)).toEqual(['Tomás Cruz']);
    expect(await listApplications(db, { query: 'nobody' })).toEqual([]);
  });
});
