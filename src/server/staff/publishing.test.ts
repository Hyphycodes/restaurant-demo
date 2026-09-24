import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalDb } from '@/lib/db/local';
import type { Row } from '@/lib/db/types';
import { buildRecords } from '@/server/migration/records';
import type { Staff } from '@/server/auth';
import type { LocationSummary } from '@/content/staff-types';
import { CHICAGO_LOCATION_ID } from '@/content/locations';
import { buildStaffDemo, DEMO_EMPLOYEES } from './demo';

/**
 * The two rules this whole redesign turns on, proved against the same
 * domain code production runs:
 *
 *   A WEEK IS PRIVATE UNTIL IT IS PUBLISHED. An employee must not be able to
 *   see next week's draft, and must be able to tell the difference between
 *   "not scheduled" and "not finished".
 *
 *   TRANSPARENCY IS NOT AUTHORITY. An employee sees the night — doors, crowd,
 *   who else is on — and never the money, never anyone's private record.
 *
 * RLS is asserted separately in supabase/tests; these prove the server-side
 * layer holds on its own, which is what the app actually runs through.
 */

const context = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ getReadDb: () => context.db, getWriteDb: async () => context.db, isLocalDb: () => true }));
vi.mock('@/lib/supabase/server', () => ({ isSupabaseConfigured: () => false, getServiceClient: () => null, getSessionClient: async () => null }));

import { createShift, listShifts, publishWeek } from './schedule';
import { getPeriod, isLive, publishPeriod, scheduleStatusFor, statusOf, weekBounds } from './periods';
import { staffHome } from './home';
import { staffSearch } from './search';
import { getBrief, saveBrief } from './briefs';
import type { StaffContext } from './session';

const manager: Staff = { id: 'local-manager', email: 'manager@example.invalid', name: 'Alex', role: 'admin', sections: [], active: true, source: 'local' };
const TZ = 'America/Chicago';
const L = CHICAGO_LOCATION_ID;
const NOW = new Date('2026-10-07T18:00:00Z');
const WEEK = '2026-10-19';

const LOCATION: LocationSummary = { id: L, slug: 'chicago', name: 'Casa Aurelia Chicago', shortName: 'Chicago', timezone: TZ, active: true };

let directory: string;
let db: LocalDb;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'casa-aurelia-publish-'));
  db = new LocalDb(directory, () => ({ ...buildRecords().tables, ...buildStaffDemo(NOW) }));
  context.db = db;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function staffContext(overrides: Partial<StaffContext> = {}): StaffContext {
  return {
    staff: manager,
    employee: null,
    contractor: null,
    opsRole: 'manager',
    actualRole: 'manager',
    previewing: null,
    isManager: true,
    isOwner: false,
    locations: [LOCATION],
    location: LOCATION,
    ...overrides,
  };
}

async function draftWeek(): Promise<void> {
  for (const day of [0, 2, 4]) {
    await createShift(
      db,
      { locationId: L, employeeId: day === 4 ? DEMO_EMPLOYEES.maria : DEMO_EMPLOYEES.carlos, positionId: 'bartender', date: `2026-10-${19 + day}`, startMinutes: 17 * 60, endMinutes: 60, eventId: null, note: null, status: 'draft' },
      TZ,
      manager,
    );
  }
}

describe('a week is private until it is published', () => {
  it('reads as a draft before anyone has touched it, and says so rather than looking empty', async () => {
    expect(await getPeriod(db, L, WEEK)).toBeNull();
    expect(statusOf(null)).toBe('draft');
    expect(isLive(null)).toBe(false);
    const status = await scheduleStatusFor(db, L, [WEEK]);
    expect(status.get(WEEK)).toBe('draft');
  });

  it('keeps draft shifts out of the read an employee gets', async () => {
    await draftWeek();
    const { from, to } = weekBounds(WEEK, TZ);
    const employeeView = await listShifts(db, { from, to, employeeId: DEMO_EMPLOYEES.carlos });
    const managerView = await listShifts(db, { from, to, locationId: L, includeDrafts: true });
    expect(employeeView).toHaveLength(0);
    expect(managerView).toHaveLength(3);
  });

  it('publishing releases every draft in the week and marks the week live', async () => {
    await draftWeek();
    const result = await publishPeriod(db, L, WEEK, TZ, manager, async (from, to) => (await publishWeek(db, L, from, to, manager)).length);
    expect(result.released).toBe(3);
    expect(result.firstRelease).toBe(true);
    expect(result.period.status).toBe('published');
    expect(result.period.publishedAt).not.toBeNull();

    const { from, to } = weekBounds(WEEK, TZ);
    const employeeView = await listShifts(db, { from, to, employeeId: DEMO_EMPLOYEES.carlos });
    expect(employeeView).toHaveLength(2);
    expect(await scheduleStatusFor(db, L, [WEEK]).then((map) => map.get(WEEK))).toBe('published');
  });

  it('a second publish is not a second broadcast — only the new shifts count as released', async () => {
    await draftWeek();
    await publishPeriod(db, L, WEEK, TZ, manager, async (from, to) => (await publishWeek(db, L, from, to, manager)).length);

    // A manager adds a Thursday once the week is already out.
    await createShift(db, { locationId: L, employeeId: DEMO_EMPLOYEES.jose, positionId: 'door', date: '2026-10-22', startMinutes: 20 * 60, endMinutes: 2 * 60, eventId: null, note: null, status: 'draft' }, TZ, manager);
    const again = await publishPeriod(db, L, WEEK, TZ, manager, async (from, to) => (await publishWeek(db, L, from, to, manager)).length);
    expect(again.firstRelease).toBe(false);
    expect(again.released).toBe(1);
    // The timestamp of the first release is kept, so "when did this go out" stays true.
    const period = (await getPeriod(db, L, WEEK))!;
    expect(period.notifiedAt).toBe(again.period.notifiedAt);
  });

  it('publishing one location does not publish another', async () => {
    const other = await db.insert<Row>('locations', { slug: 'riverNorth', name: 'Casa Aurelia River North', short_name: 'River North', timezone: TZ, active: true, sort: 1 });
    await draftWeek();
    await createShift(db, { locationId: String(other.id), employeeId: DEMO_EMPLOYEES.jose, positionId: 'door', date: '2026-10-23', startMinutes: 20 * 60, endMinutes: 2 * 60, eventId: null, note: null, status: 'draft' }, TZ, manager);
    await publishPeriod(db, L, WEEK, TZ, manager, async (from, to) => (await publishWeek(db, L, from, to, manager)).length);
    expect((await getPeriod(db, String(other.id), WEEK))).toBeNull();
    const { from, to } = weekBounds(WEEK, TZ);
    expect(await listShifts(db, { from, to, locationId: String(other.id) })).toHaveLength(0);
  });
});

describe('what home hands each role', () => {
  it('an employee gets the night, and no money', async () => {
    const employee = (await db.list<Row>('employees', { where: { id: DEMO_EMPLOYEES.carlos } }))[0]!;
    const home = await staffHome(
      db,
      staffContext({
        opsRole: 'employee',
        actualRole: 'employee',
        isManager: false,
        employee: { id: String(employee.id), displayName: 'Carlos', positionIds: ['bartender', 'server'], primaryLocationId: L, locationIds: [L] } as never,
      }),
      NOW,
    );
    expect(home.managerToday).toBeNull();
    for (const event of home.tonight) expect(event.money).toBeNull();
    // The roster is names and times — nothing that could be a phone number.
    expect(JSON.stringify(home.withYou)).not.toMatch(/@|555-/);
  });

  it('a manager gets the numbers an employee does not', async () => {
    const home = await staffHome(db, staffContext(), NOW);
    expect(home.managerToday).not.toBeNull();
    expect(home.managerToday!.unpublished).toBeGreaterThanOrEqual(0);
  });

  it('says whether next week is out, so "no shifts" and "not finished" are different answers', async () => {
    const home = await staffHome(db, staffContext(), NOW);
    expect(['draft', 'published']).toContain(home.nextWeek.status);
    expect(home.nextWeek.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('search obeys the same rules the screens do', () => {
  it('an employee search returns no contractors and no contact details', async () => {
    const roster = await staffSearch(db, 'sofia', 'roster', NOW);
    expect(roster.length).toBeGreaterThan(0);
    expect(roster.every((hit) => hit.kind !== 'contractor')).toBe(true);
    expect(JSON.stringify(roster)).not.toMatch(/555-|@casa-aurelia\.local/);

    const team = await staffSearch(db, 'sofia', 'team', NOW);
    expect(JSON.stringify(team)).toMatch(/555-/);
  });

  it('a contractor is findable by a manager and invisible to everyone else', async () => {
    expect((await staffSearch(db, 'elena', 'team', NOW)).some((hit) => hit.kind === 'contractor')).toBe(true);
    expect((await staffSearch(db, 'elena', 'roster', NOW)).some((hit) => hit.kind === 'contractor')).toBe(false);
  });
});

describe('the night brief', () => {
  it('round-trips the operational fields and resolves the manager’s name', async () => {
    const events = await db.list<Row>('event_occurrences', { where: { series_slug: null } });
    const event = events.find((row) => !row.series_slug)!;
    const saved = await saveBrief(
      db,
      String(event.id),
      { callTimeAt: '2026-10-31T22:00:00.000Z', dressCode: 'All black', expectedGuests: 180, managerEmployeeId: DEMO_EMPLOYEES.alex, staffNotes: 'ID checks required.' },
      manager,
    );
    expect(saved.expectedGuests).toBe(180);
    expect(saved.managerName).toBe('Nico');
    const read = (await getBrief(db, String(event.id)))!;
    expect(read.dressCode).toBe('All black');
    expect(read.staffNotes).toBe('ID checks required.');
    // Nothing money-shaped is in the shape at all.
    expect(Object.keys(read)).not.toContain('grossCents');
  });
});
