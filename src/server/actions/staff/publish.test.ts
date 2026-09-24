import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalDb } from '@/lib/db/local';
import type { Row } from '@/lib/db/types';
import { CHICAGO_LOCATION_ID } from '@/content/locations';
import type { LocationSummary } from '@/content/staff-types';
import { buildRecords } from '@/server/migration/records';
import type { Staff } from '@/server/auth';
import { buildStaffDemo, DEMO_EMPLOYEES } from '@/server/staff/demo';
import { opsCan, OPS_DENIED_MESSAGE, type OpsCapability } from '@/server/staff/permissions';

/**
 * The notification behaviour, through the real server action.
 *
 * Publishing a schedule is the one thing in this app that reaches fourteen
 * people's phones at once, so the thing worth proving is restraint: everyone
 * hears the first time, and after that only the person whose Friday moved.
 * Spam is not a cosmetic problem here — it is how an app stops being read.
 */

const TZ = 'America/Chicago';
const L = CHICAGO_LOCATION_ID;
const NOW = new Date('2026-10-07T18:00:00Z');
const WEEK = '2026-10-19';

const LOCATION: LocationSummary = { id: L, slug: 'chicago', name: 'Casa Aurelia Chicago', shortName: 'Chicago', timezone: TZ, active: true };
const manager: Staff = { id: 'local-manager', email: 'manager@example.invalid', name: 'Alex', role: 'admin', sections: [], active: true, source: 'local' };

const state = vi.hoisted(() => ({ db: null as unknown, role: 'manager' as string }));

vi.mock('@/lib/db', () => ({ getReadDb: () => state.db, getWriteDb: async () => state.db, isLocalDb: () => true }));
vi.mock('@/lib/supabase/server', () => ({ isSupabaseConfigured: () => false, getServiceClient: () => null, getSessionClient: async () => null }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

// The session is the one thing a test cannot have: it reads cookies. The
// capability check itself is NOT stubbed out — `requireOps` still runs the
// real matrix against the role under test, so a test that publishes as an
// employee fails the way the app would.
vi.mock('@/server/staff/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/staff/session')>('@/server/staff/session');
  const context = () => ({
    staff: manager,
    employee: null,
    contractor: null,
    opsRole: state.role,
    actualRole: state.role,
    previewing: null,
    isManager: state.role === 'manager' || state.role === 'owner',
    isOwner: state.role === 'owner',
    locations: [LOCATION],
    location: LOCATION,
  });
  return {
    ...actual,
    getStaffContext: async () => context(),
    requireOps: async (capability: OpsCapability) => {
      if (!opsCan({ role: state.role as never }, capability)) throw new Error(OPS_DENIED_MESSAGE[capability]);
      return context();
    },
  };
});

import { publishSchedule, saveShift } from './schedule';
import { createShift, listShifts } from '@/server/staff/schedule';
import { getPeriod, weekBounds } from '@/server/staff/periods';

let directory: string;
let db: LocalDb;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'casa-aurelia-publish-action-'));
  db = new LocalDb(directory, () => ({ ...buildRecords().tables, ...buildStaffDemo(NOW) }));
  state.db = db;
  state.role = 'manager';
  // The demo's own week is already out; clear the notifications so the counts
  // below are about this test and nothing else.
  for (const row of await db.list<Row>('staff_notifications')) await db.remove('staff_notifications', String(row.id));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function draft(employeeId: string, date: string): Promise<void> {
  await createShift(db, { locationId: L, employeeId, positionId: 'bartender', date, startMinutes: 17 * 60, endMinutes: 60, eventId: null, note: null, status: 'draft' }, TZ, manager);
}

async function scheduleNotices(): Promise<Row[]> {
  return db.list<Row>('staff_notifications', { where: { kind: 'schedule_published' } });
}

describe('publishing a schedule', () => {
  it('tells everyone on the week, once each, and records the release', async () => {
    await draft(DEMO_EMPLOYEES.carlos, '2026-10-19');
    await draft(DEMO_EMPLOYEES.carlos, '2026-10-21');
    await draft(DEMO_EMPLOYEES.maria, '2026-10-23');

    const result = await publishSchedule({ ok: true, message: '' }, form({ weekStart: WEEK, locationId: L }));
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/live/i);

    const told = await scheduleNotices();
    expect(told).toHaveLength(2);
    expect(new Set(told.map((row) => String(row.employee_id)))).toEqual(new Set([DEMO_EMPLOYEES.carlos, DEMO_EMPLOYEES.maria]));
    expect(String(told[0]!.title)).toMatch(/schedule is live/i);
    expect(String(told[0]!.href)).toContain(WEEK);

    const period = (await getPeriod(db, L, WEEK))!;
    expect(period.status).toBe('published');
    expect(period.notifiedAt).not.toBeNull();
  });

  it('a later change tells only the person it moves — nobody hears twice', async () => {
    await draft(DEMO_EMPLOYEES.carlos, '2026-10-19');
    await draft(DEMO_EMPLOYEES.maria, '2026-10-23');
    await publishSchedule({ ok: true, message: '' }, form({ weekStart: WEEK, locationId: L }));
    expect(await scheduleNotices()).toHaveLength(2);

    await draft(DEMO_EMPLOYEES.jose, '2026-10-22');
    const second = await publishSchedule({ ok: true, message: '' }, form({ weekStart: WEEK, locationId: L }));
    expect(second.ok).toBe(true);

    const told = await scheduleNotices();
    expect(told).toHaveLength(3);
    // Carlos and Maria were told once, at the first release, and not again.
    expect(told.filter((row) => String(row.employee_id) === DEMO_EMPLOYEES.carlos)).toHaveLength(1);
    expect(told.filter((row) => String(row.employee_id) === DEMO_EMPLOYEES.jose)).toHaveLength(1);
    expect(String(told.find((row) => String(row.employee_id) === DEMO_EMPLOYEES.jose)!.title)).toMatch(/new shifts/i);
  });

  it('publishing an empty week is honest about it rather than silently succeeding', async () => {
    const result = await publishSchedule({ ok: true, message: '' }, form({ weekStart: '2026-11-16', locationId: L }));
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/nothing new to send/i);
    expect(await scheduleNotices()).toHaveLength(0);
  });

  it('an employee cannot publish a schedule, even by posting the form directly', async () => {
    state.role = 'employee';
    await draft(DEMO_EMPLOYEES.carlos, '2026-10-19');
    const result = await publishSchedule({ ok: true, message: '' }, form({ weekStart: WEEK, locationId: L }));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/only a manager/i);
    expect(await scheduleNotices()).toHaveLength(0);
    expect(await getPeriod(db, L, WEEK)).toBeNull();
  });

  it('a contractor cannot publish a schedule either', async () => {
    state.role = 'contractor';
    const result = await publishSchedule({ ok: true, message: '' }, form({ weekStart: WEEK, locationId: L }));
    expect(result.ok).toBe(false);
    expect(await getPeriod(db, L, WEEK)).toBeNull();
  });
});

describe('changing a shift after the week is out', () => {
  async function changeNotices(): Promise<Row[]> {
    return db.list<Row>('staff_notifications', { where: { kind: 'shift_changed' } });
  }

  it('tells the one person whose shift moved, and nobody else', async () => {
    await draft(DEMO_EMPLOYEES.carlos, '2026-10-19');
    await draft(DEMO_EMPLOYEES.maria, '2026-10-23');
    await publishSchedule({ ok: true, message: '' }, form({ weekStart: WEEK, locationId: L }));

    const { from, to } = weekBounds(WEEK, TZ);
    const carlos = (await listShifts(db, { from, to, employeeId: DEMO_EMPLOYEES.carlos }))[0]!;
    const result = await saveShift(
      { ok: true, message: '' },
      form({ id: carlos.id, employeeId: DEMO_EMPLOYEES.carlos, positionId: 'bartender', locationId: L, date: '2026-10-19', startTime: '18:00', endTime: '01:00', status: 'published' }),
    );
    expect(result.ok).toBe(true);

    const told = await changeNotices();
    expect(told).toHaveLength(1);
    expect(String(told[0]!.employee_id)).toBe(DEMO_EMPLOYEES.carlos);
    expect(String(told[0]!.title)).toMatch(/Shift changed/i);
  });

  it('tells both people when a published shift moves to somebody else', async () => {
    await draft(DEMO_EMPLOYEES.carlos, '2026-10-19');
    await publishSchedule({ ok: true, message: '' }, form({ weekStart: WEEK, locationId: L }));

    const { from, to } = weekBounds(WEEK, TZ);
    const carlos = (await listShifts(db, { from, to, employeeId: DEMO_EMPLOYEES.carlos }))[0]!;
    await saveShift(
      { ok: true, message: '' },
      form({ id: carlos.id, employeeId: DEMO_EMPLOYEES.maria, positionId: 'bartender', locationId: L, date: '2026-10-19', startTime: '17:00', endTime: '01:00', status: 'published' }),
    );

    const told = await changeNotices();
    expect(new Set(told.map((row) => String(row.employee_id)))).toEqual(new Set([DEMO_EMPLOYEES.carlos, DEMO_EMPLOYEES.maria]));
  });

  it('says nothing at all about a draft — that is the whole point of a draft', async () => {
    await draft(DEMO_EMPLOYEES.carlos, '2026-10-19');
    const { from, to } = weekBounds(WEEK, TZ);
    const carlos = (await listShifts(db, { from, to, employeeId: DEMO_EMPLOYEES.carlos, includeDrafts: true }))[0]!;
    await saveShift(
      { ok: true, message: '' },
      form({ id: carlos.id, employeeId: DEMO_EMPLOYEES.maria, positionId: 'bartender', locationId: L, date: '2026-10-20', startTime: '19:00', endTime: '02:00', status: 'draft' }),
    );
    expect(await changeNotices()).toHaveLength(0);
    expect(await scheduleNotices()).toHaveLength(0);
  });
});
