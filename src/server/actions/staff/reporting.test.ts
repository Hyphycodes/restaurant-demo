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
 * Reporting an incident is the clearest case of "may write, may not read".
 *
 * The person who saw it should be able to write it down without waiting for
 * a manager — otherwise it does not get written down. But an employee must
 * not then be able to name a coworker in the record, close it, or read
 * anybody's log, including their own entry. Every one of those narrowings
 * happens in the action, not in which form was rendered, so a hand-posted
 * form gets the same treatment.
 */

const TZ = 'America/Chicago';
const L = CHICAGO_LOCATION_ID;
const NOW = new Date('2026-10-07T18:00:00Z');
const LOCATION: LocationSummary = { id: L, slug: 'chicago', name: 'Casa Aurelia Chicago', shortName: 'Chicago', timezone: TZ, active: true };
const account: Staff = { id: 'local-staff', email: 'carlos@example.invalid', name: 'Carlos', role: 'staff', sections: [], active: true, source: 'local' };

const state = vi.hoisted(() => ({ db: null as unknown, role: 'employee' as string }));

vi.mock('@/lib/db', () => ({ getReadDb: () => state.db, getWriteDb: async () => state.db, isLocalDb: () => true }));
vi.mock('@/lib/supabase/server', () => ({ isSupabaseConfigured: () => false, getServiceClient: () => null, getSessionClient: async () => null }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

vi.mock('@/server/staff/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/staff/session')>('@/server/staff/session');
  const context = () => ({
    staff: account,
    employee: { id: DEMO_EMPLOYEES.carlos, displayName: 'Carlos', positionIds: ['bartender'], primaryLocationId: L, locationIds: [L] },
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
    contextCan: (_context: unknown, capability: OpsCapability) => opsCan({ role: state.role as never }, capability),
    requireOps: async (capability: OpsCapability) => {
      if (!opsCan({ role: state.role as never }, capability)) throw new Error(OPS_DENIED_MESSAGE[capability]);
      return context();
    },
  };
});

import { saveIncidentAction } from './incidents';

let directory: string;
let db: LocalDb;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'casa-aurelia-report-'));
  db = new LocalDb(directory, () => ({ ...buildRecords().tables, ...buildStaffDemo(NOW) }));
  state.db = db;
  state.role = 'employee';
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) for (const entry of value) data.append(key, entry);
    else data.set(key, value);
  }
  return data;
}

async function incidents(): Promise<Row[]> {
  return db.list<Row>('incidents');
}

/**
 * Found by what it says rather than by position. The demo week is built
 * against a fixed clock and these writes use the real one, so "the newest
 * row" is not a safe way to find what a test just wrote.
 */
async function bySummary(summary: string): Promise<Row> {
  const row = (await incidents()).find((entry) => String(entry.summary) === summary);
  if (!row) throw new Error(`No incident called "${summary}"`);
  return row;
}

describe('an employee reporting something', () => {
  it('records it, open, and tells the managers', async () => {
    const before = (await incidents()).length;
    const result = await saveIncidentAction({ ok: true, message: '' }, form({ summary: 'Guest fell on the patio step', category: 'injury', description: 'Wet after the rain. Helped them up, offered ice.' }));
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/with the managers/i);

    expect(await incidents()).toHaveLength(before + 1);
    const recorded = await bySummary('Guest fell on the patio step');
    expect(String(recorded.follow_up_status)).toBe('open');
    expect(String(recorded.location_id)).toBe(L);

    const told = await db.list<Row>('staff_notifications', { where: { kind: 'incident_reported' } });
    expect(told.length).toBeGreaterThan(0);
    expect(told.some((row) => String(row.employee_id) === DEMO_EMPLOYEES.alex)).toBe(true);
    // Never notifies the person who wrote it.
    expect(told.every((row) => String(row.employee_id) !== DEMO_EMPLOYEES.carlos)).toBe(true);
  });

  it('cannot name a coworker in it, however the form is posted', async () => {
    await saveIncidentAction(
      { ok: true, message: '' },
      form({ summary: 'Argument at the door', category: 'security', employeeIds: [DEMO_EMPLOYEES.maria, DEMO_EMPLOYEES.jose], followUpStatus: 'closed', actionsTaken: 'Nothing' }),
    );
    const recorded = await bySummary('Argument at the door');
    const named = await db.list<Row>('incident_employees', { where: { incident_id: String(recorded.id) } });
    expect(named.map((row) => String(row.employee_id))).toEqual([DEMO_EMPLOYEES.carlos]);
    // A closed status and a manager's "actions taken" are not theirs to set.
    expect(String(recorded.follow_up_status)).toBe('open');
    expect(recorded.actions_taken ?? null).toBeNull();
  });

  it('cannot edit an existing incident — an id posted by hand starts a new report instead', async () => {
    const existing = (await incidents())[0]!;
    expect(existing).toBeTruthy();
    await saveIncidentAction({ ok: true, message: '' }, form({ id: String(existing.id), summary: 'Rewritten by an employee', category: 'other' }));
    const after = await db.get<Row>('incidents', String(existing.id));
    expect(String(after!.summary)).toBe(String(existing.summary));
    expect((await incidents()).some((row) => String(row.summary) === 'Rewritten by an employee')).toBe(true);
  });

  it('needs a line saying what happened', async () => {
    const result = await saveIncidentAction({ ok: true, message: '' }, form({ summary: '   ', category: 'other' }));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/one line/i);
  });
});

describe('a manager recording one', () => {
  it('keeps the fields an employee does not get', async () => {
    state.role = 'manager';
    await saveIncidentAction(
      { ok: true, message: '' },
      form({ summary: 'Card reader down for twenty minutes', category: 'equipment', employeeIds: [DEMO_EMPLOYEES.maria], followUpStatus: 'monitoring', actionsTaken: 'Swapped to the backup terminal.' }),
    );
    const recorded = await bySummary('Card reader down for twenty minutes');
    expect(String(recorded.follow_up_status)).toBe('monitoring');
    expect(String(recorded.actions_taken)).toMatch(/backup terminal/);
    const named = await db.list<Row>('incident_employees', { where: { incident_id: String(recorded.id) } });
    expect(named.map((row) => String(row.employee_id))).toEqual([DEMO_EMPLOYEES.maria]);
  });
});

describe('a contractor', () => {
  it('cannot report an incident at all — they are not staff', async () => {
    state.role = 'contractor';
    const before = (await incidents()).length;
    const result = await saveIncidentAction({ ok: true, message: '' }, form({ summary: 'Anything', category: 'other' }));
    expect(result.ok).toBe(false);
    expect((await incidents()).length).toBe(before);
  });
});
