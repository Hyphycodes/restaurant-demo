import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalDb } from '@/lib/db/local';
import type { Row } from '@/lib/db/types';
import { buildRecords } from '@/server/migration/records';
import type { Staff } from '@/server/auth';
import { buildStaffDemo, DEMO_EMPLOYEES, DEMO_MODULES } from './demo';

/**
 * The rules that matter, run against the same domain code production runs,
 * on the file-backed database with the demo week loaded. RLS is asserted
 * separately in supabase/tests/employee-operations-rls.sql; these prove
 * the server-side layer holds on its own.
 */

const context = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db', () => ({ getReadDb: () => context.db, getWriteDb: async () => context.db, isLocalDb: () => true }));
vi.mock('@/lib/supabase/server', () => ({ isSupabaseConfigured: () => false, getServiceClient: () => null, getSessionClient: async () => null }));

import { listRequirementsFor, onboardingFor } from './requirements';
import { decideTimeOff, requestTimeOff } from './timeoff';
import { createShift, listShiftViews, reassignShift, shiftHistory, shiftInstants } from './schedule';
import { assignToEvent, eventStaffing } from './staffing';
import { answerKeys, getModule, grade, listAssignments, recordAttempt, saveModule, moduleInputFor } from './training';
import { saveWeeklyAvailability, listAvailabilityFor } from './availability';
import { listEmployees, getEmployee } from './employees';
import { listNotes } from './notes';
import { deriveOpsRole } from './permissions';
import { claimOpenShift, claimShiftRequest, decideShiftRequest, openShiftRequest } from './coverage';
import { feedFor } from './announcements';
import { sweepExpiringDocuments } from './expiry';

const manager: Staff = { id: 'local-manager', email: 'manager@example.invalid', name: 'Alex', role: 'admin', sections: [], active: true, source: 'local' };
const TZ = 'America/Chicago';
const NOW = new Date('2026-10-07T18:00:00Z');

let directory: string;
let db: LocalDb;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cosa-nostra-staff-'));
  db = new LocalDb(directory, () => ({ ...buildRecords().tables, ...buildStaffDemo(NOW) }));
  context.db = db;
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('documents stay private', () => {
  it('an employee only sees their own requirements; another employee’s files are not in the result', async () => {
    const carlos = await listRequirementsFor(db, DEMO_EMPLOYEES.carlos);
    expect(carlos.length).toBeGreaterThan(0);
    expect(carlos.every((item) => item.employeeId === DEMO_EMPLOYEES.carlos)).toBe(true);
    // Maria's uploaded BASSET card does not appear in Carlos's list.
    expect(carlos.some((item) => item.fileName === 'basset.pdf' && item.employeeId !== DEMO_EMPLOYEES.carlos)).toBe(false);
  });

  it('computes expiry from the stored date rather than trusting the stored status', async () => {
    const carlos = await listRequirementsFor(db, DEMO_EMPLOYEES.carlos, { today: '2026-10-07' });
    expect(carlos.find((item) => item.type.slug === 'basset')?.state).toBe('expiring');
    const maria = await listRequirementsFor(db, DEMO_EMPLOYEES.maria, { today: '2026-10-07' });
    expect(maria.find((item) => item.type.slug === 'food-handler')?.state).toBe('expired');
    expect(maria.find((item) => item.type.slug === 'basset')?.state).toBe('submitted');
  });
});

describe('time off', () => {
  it('an employee cannot approve their own request even as a manager', async () => {
    const request = await requestTimeOff(db, DEMO_EMPLOYEES.alex, { startsOn: '2026-11-01', endsOn: '2026-11-02', reason: null, note: null });
    await expect(decideTimeOff(db, request.id, 'approved', null, manager, DEMO_EMPLOYEES.alex)).rejects.toThrow(/cannot approve your own/);
    const { after } = await decideTimeOff(db, request.id, 'approved', 'Enjoy', manager, DEMO_EMPLOYEES.sam);
    expect(after.status).toBe('approved');
  });

  it('approved time off shows as a warning on a shift that day, without preventing it', async () => {
    const request = await requestTimeOff(db, DEMO_EMPLOYEES.carlos, { startsOn: '2026-10-20', endsOn: '2026-10-20', reason: null, note: null });
    await decideTimeOff(db, request.id, 'approved', null, manager, null);
    const shift = await createShift(db, { locationId: 'c05a0000-0000-4000-8000-000000000001', employeeId: DEMO_EMPLOYEES.carlos, positionId: 'bartender', date: '2026-10-20', startMinutes: 17 * 60, endMinutes: 23 * 60, eventId: null, note: null, status: 'published' }, TZ, manager);
    expect(shift.id).toBeTruthy();
    const views = await listShiftViews(db, { from: '2026-10-20T00:00:00Z', to: '2026-10-22T00:00:00Z', employeeId: DEMO_EMPLOYEES.carlos }, { withWarnings: true });
    expect(views[0]?.warnings.map((warning) => warning.kind)).toContain('time_off');
  });
});

describe('scheduling', () => {
  it('detects the availability conflict for Carlos on a Monday', async () => {
    const shift = await createShift(db, { locationId: 'c05a0000-0000-4000-8000-000000000001', employeeId: DEMO_EMPLOYEES.carlos, positionId: 'bartender', date: '2026-10-19', startMinutes: 17 * 60, endMinutes: 23 * 60, eventId: null, note: null, status: 'draft' }, TZ, manager);
    const views = await listShiftViews(db, { from: '2026-10-19T00:00:00Z', to: '2026-10-21T00:00:00Z', employeeId: DEMO_EMPLOYEES.carlos, includeDrafts: true }, { withWarnings: true });
    expect(views.find((view) => view.id === shift.id)?.warnings[0]?.message).toMatch(/unavailable/);
  });

  it('reassigning a shift keeps who had it in the history', async () => {
    const shift = await createShift(db, { locationId: 'c05a0000-0000-4000-8000-000000000001', employeeId: DEMO_EMPLOYEES.carlos, positionId: 'bartender', date: '2026-10-24', startMinutes: 17 * 60, endMinutes: 1 * 60, eventId: null, note: null, status: 'published' }, TZ, manager);
    const { before, after } = await reassignShift(db, shift.id, DEMO_EMPLOYEES.maria, manager);
    expect(before.employeeId).toBe(DEMO_EMPLOYEES.carlos);
    expect(after.employeeId).toBe(DEMO_EMPLOYEES.maria);
    const history = await shiftHistory(db, shift.id);
    expect(history.map((entry) => entry.reason)).toEqual(['reassigned', 'created']);
    expect(history[0]?.before?.employeeId).toBe(DEMO_EMPLOYEES.carlos);
  });

  it('an end time at or before the start is the next morning', () => {
    const { startsAt, endsAt } = shiftInstants({ date: '2026-10-24', startMinutes: 17 * 60, endMinutes: 2 * 60 }, TZ);
    expect(Date.parse(endsAt) - Date.parse(startsAt)).toBe(9 * 3_600_000);
  });

  it('filters shifts by location', async () => {
    const other = await db.insert<Row>('locations', { slug: 'joliet', name: 'Cosa Nostra Joliet', short_name: 'Joliet', timezone: TZ, active: true, sort: 1 });
    await createShift(db, { locationId: String(other.id), employeeId: DEMO_EMPLOYEES.jose, positionId: 'door', date: '2026-10-24', startMinutes: 20 * 60, endMinutes: 2 * 60, eventId: null, note: null, status: 'published' }, TZ, manager);
    const joliet = await listShiftViews(db, { from: '2026-10-24T00:00:00Z', to: '2026-10-26T00:00:00Z', locationId: String(other.id) });
    const chicago = await listShiftViews(db, { from: '2026-10-24T00:00:00Z', to: '2026-10-26T00:00:00Z', locationId: 'c05a0000-0000-4000-8000-000000000001' });
    expect(joliet).toHaveLength(1);
    expect(joliet[0]?.locationName).toBe('Joliet');
    expect(chicago.every((shift) => shift.locationId !== String(other.id))).toBe(true);
  });
});

describe('coverage', () => {
  it('runs the offer → claim → approve flow and moves the shift', async () => {
    const shift = await createShift(db, { locationId: 'c05a0000-0000-4000-8000-000000000001', employeeId: DEMO_EMPLOYEES.carlos, positionId: 'bartender', date: '2026-10-31', startMinutes: 17 * 60, endMinutes: 1 * 60, eventId: null, note: null, status: 'published' }, TZ, manager);
    await expect(openShiftRequest(db, DEMO_EMPLOYEES.maria, { shiftId: shift.id, kind: 'cover', note: null, swapShiftId: null })).rejects.toThrow(/own shift/);
    const request = await openShiftRequest(db, DEMO_EMPLOYEES.carlos, { shiftId: shift.id, kind: 'cover', note: null, swapShiftId: null });
    await expect(claimShiftRequest(db, DEMO_EMPLOYEES.carlos, String(request.id))).rejects.toThrow(/your own/);
    await claimShiftRequest(db, DEMO_EMPLOYEES.maria, String(request.id));
    await decideShiftRequest(db, String(request.id), 'approved', null, manager);
    const moved = (await listShiftViews(db, { from: '2026-10-31T00:00:00Z', to: '2026-11-02T00:00:00Z' })).find((view) => view.id === shift.id);
    expect(moved?.employeeId).toBe(DEMO_EMPLOYEES.maria);
    expect((await shiftHistory(db, shift.id))[0]?.reason).toMatch(/coverage approved/);
  });
});

describe('open shifts', () => {
  it('picking one up becomes a claimed request, and approving it assigns the shift', async () => {
    const open = await createShift(db, { locationId: 'c05a0000-0000-4000-8000-000000000001', employeeId: null, positionId: 'bartender', date: '2026-11-07', startMinutes: 17 * 60, endMinutes: 1 * 60, eventId: null, note: null, status: 'published' }, TZ, manager);
    const request = await claimOpenShift(db, DEMO_EMPLOYEES.maria, open.id);
    expect(request.status).toBe('claimed');
    expect(request.claimed_by).toBe(DEMO_EMPLOYEES.maria);
    // Two people cannot both be waiting on the same open shift.
    await expect(claimOpenShift(db, DEMO_EMPLOYEES.carlos, open.id)).rejects.toThrow(/already asked/);
    await decideShiftRequest(db, String(request.id), 'approved', null, manager);
    const after = (await listShiftViews(db, { from: '2026-11-07T00:00:00Z', to: '2026-11-09T00:00:00Z' })).find((view) => view.id === open.id);
    expect(after?.employeeId).toBe(DEMO_EMPLOYEES.maria);
  });

  it('refuses a shift that already has someone on it', async () => {
    const taken = await createShift(db, { locationId: 'c05a0000-0000-4000-8000-000000000001', employeeId: DEMO_EMPLOYEES.carlos, positionId: 'bartender', date: '2026-11-14', startMinutes: 17 * 60, endMinutes: 1 * 60, eventId: null, note: null, status: 'published' }, TZ, manager);
    await expect(claimOpenShift(db, DEMO_EMPLOYEES.maria, taken.id)).rejects.toThrow(/no longer open/);
  });
});

describe('training', () => {
  it('grades multiple choice, true/false and multi-select, and applies the passing score', async () => {
    const lesson = (await getModule(db, DEMO_MODULES.scanner))!;
    const keys = await answerKeys(db, lesson.id);
    const allRight: Record<string, string[]> = {};
    for (const question of lesson.questions) allRight[question.id] = keys.get(question.id)!.correct;
    expect(grade(lesson.questions, keys, allRight, lesson.passingScore)).toMatchObject({ score: 100, passed: true, correct: 3, total: 3 });
    const partial = { ...allRight, [lesson.questions[2]!.id]: ['o2'] };
    const result = grade(lesson.questions, keys, partial, 80);
    expect(result).toMatchObject({ score: 67, passed: false });
    expect(result.review.find((entry) => entry.questionId === lesson.questions[2]!.id)?.correctOptionIds).toEqual(['o2', 'o3']);
  });

  it('the questions an employee receives carry no answers', async () => {
    const lesson = (await getModule(db, DEMO_MODULES.scanner))!;
    for (const question of lesson.questions) {
      expect(JSON.stringify(question)).not.toMatch(/correct/);
    }
  });

  it('a passed attempt completes the assignment on the current version; a new version makes it outdated', async () => {
    const lesson = (await getModule(db, DEMO_MODULES.scanner))!;
    const keys = await answerKeys(db, lesson.id);
    const answers: Record<string, string[]> = {};
    for (const question of lesson.questions) answers[question.id] = keys.get(question.id)!.correct;
    const assignment = (await listAssignments(db, { employeeId: DEMO_EMPLOYEES.jose, moduleId: lesson.id, today: '2026-10-07' }))[0]!;
    await recordAttempt(db, assignment, lesson, answers, grade(lesson.questions, keys, answers, lesson.passingScore));
    const done = (await listAssignments(db, { employeeId: DEMO_EMPLOYEES.jose, moduleId: lesson.id, today: '2026-10-07' }))[0]!;
    expect(done.status).toBe('completed');
    expect(done.completedVersion).toBe(1);
    expect(done.outdated).toBe(false);
    expect(done.expiresAt).not.toBeNull();

    const input = (await moduleInputFor(db, lesson.id))!;
    await saveModule(db, lesson.id, input, manager, true);
    const after = (await listAssignments(db, { employeeId: DEMO_EMPLOYEES.jose, moduleId: lesson.id, today: '2026-10-07' }))[0]!;
    expect(after.module.version).toBe(2);
    expect(after.outdated).toBe(true);
    expect((await answerKeys(db, lesson.id)).size).toBe(3);
  });

  it('Carlos completed alcohol service on version 1 and the module is now version 2, so he is outdated', async () => {
    const carlos = (await listAssignments(db, { employeeId: DEMO_EMPLOYEES.carlos, moduleId: DEMO_MODULES.alcohol, today: '2026-10-07' }))[0]!;
    expect(carlos.outdated).toBe(true);
  });
});

describe('event staffing', () => {
  it('assigning someone to an event creates a published shift linked to that event', async () => {
    const events = await db.list<Row>('event_occurrences', { where: { series_slug: null } });
    const event = events.find((row) => !row.series_slug)!;
    const row = await assignToEvent(db, { eventId: String(event.id), employeeId: DEMO_EMPLOYEES.maria, role: 'server', startMinutes: null, endMinutes: null, note: null }, TZ, manager, 'c05a0000-0000-4000-8000-000000000001');
    expect(row.shift_id).toBeTruthy();
    const shift = await db.get<Row>('shifts', String(row.shift_id));
    expect(shift?.event_id).toBe(event.id);
    expect(shift?.status).toBe('published');
    const board = (await eventStaffing(db, String(event.id)))!;
    expect(board.assignments.some((assignment) => assignment.employeeId === DEMO_EMPLOYEES.maria && assignment.role === 'server')).toBe(true);
    expect(board.event.title).toBe(event.title);
  });

  it('flags a door assignment whose scanner training is not complete', async () => {
    const events = await db.list<Row>('event_occurrences', { where: { series_slug: null } });
    const event = events.find((row) => !row.series_slug)!;
    await assignToEvent(db, { eventId: String(event.id), employeeId: DEMO_EMPLOYEES.dani, role: 'door', startMinutes: null, endMinutes: null, note: null }, TZ, manager, 'c05a0000-0000-4000-8000-000000000001');
    const board = (await eventStaffing(db, String(event.id)))!;
    expect(board.assignments.find((assignment) => assignment.employeeId === DEMO_EMPLOYEES.dani)?.readiness).toContain('Door & QR scanner not completed');
  });
});

describe('availability and profile boundaries', () => {
  it('saving availability writes only that employee’s rows', async () => {
    await saveWeeklyAvailability(db, DEMO_EMPLOYEES.dani, [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, available: weekday !== 0, startMinutes: null, endMinutes: null, note: null })));
    const dani = await listAvailabilityFor(db, DEMO_EMPLOYEES.dani);
    const carlos = await listAvailabilityFor(db, DEMO_EMPLOYEES.carlos);
    expect(dani.rules).toHaveLength(7);
    expect(carlos.rules.find((rule) => rule.weekday === 1)?.available).toBe(false);
  });

  it('an inactive employee resolves to no staff access', async () => {
    await db.update('employees', DEMO_EMPLOYEES.jose, { status: 'inactive' });
    const jose = (await getEmployee(db, DEMO_EMPLOYEES.jose))!;
    expect(deriveOpsRole({ role: 'staff', active: true, hasEmployee: true, employeeActive: jose.status !== 'inactive' })).toBe('none');
    expect((await listEmployees(db)).some((employee) => employee.id === DEMO_EMPLOYEES.jose)).toBe(false);
  });

  it('manager notes are read only through the manager-gated reader', async () => {
    const notes = await listNotes(db, DEMO_EMPLOYEES.carlos);
    expect(notes[0]?.kind).toBe('recognition');
    // The employee summary and detail carry no note fields at all.
    const carlos = (await getEmployee(db, DEMO_EMPLOYEES.carlos))!;
    expect(JSON.stringify(carlos)).not.toMatch(/double-scan/);
  });
});

describe('the document expiry sweep', () => {
  it('warns about a certificate inside thirty days, and only once', async () => {
    const ids = (await listEmployees(db)).map((employee) => employee.id);
    // Carlos's BASSET expires in 20 days in the demo week.
    const first = await sweepExpiringDocuments(db, ids, '2026-10-07');
    expect(first.told).toBe(1);
    const told = await db.list<Row>('staff_notifications', { where: { employee_id: DEMO_EMPLOYEES.carlos, kind: 'document_expiring' } });
    expect(told).toHaveLength(1);
    expect(String(told[0]!.title)).toMatch(/BASSET/);

    // A second run the next day says nothing.
    const second = await sweepExpiringDocuments(db, ids, '2026-10-08');
    expect(second.told).toBe(0);
  });

  it('says nothing about a document that has already lapsed, or one far off', async () => {
    const ids = (await listEmployees(db)).map((employee) => employee.id);
    await sweepExpiringDocuments(db, ids, '2026-10-07');
    const all = await db.list<Row>('staff_notifications', { where: { kind: 'document_expiring' } });
    // Maria's food handler expired 105 days ago and Carlos's food handler is
    // 795 days out; neither is a warning.
    expect(all.some((row) => String(row.employee_id) === DEMO_EMPLOYEES.maria)).toBe(false);
    expect(all.every((row) => !String(row.title).match(/Food handler/))).toBe(true);
  });
});

describe('onboarding and announcements', () => {
  it('counts the new hire’s checklist from the profile and the requirement rows', async () => {
    const progress = await onboardingFor(db, DEMO_EMPLOYEES.dani, { today: '2026-10-07' });
    expect(progress.total).toBeGreaterThanOrEqual(10);
    expect(progress.stage).toBe('in_progress');
    expect(progress.items.find((item) => item.type.slug === 'welcome')?.state).toBe('complete');
    expect(progress.items.find((item) => item.type.slug === 'emergency-contact')?.state).toBe('missing');
    expect(progress.items.find((item) => item.type.slug === 'positions')?.state).toBe('complete');
  });

  it('an announcement aimed at a location and positions reaches only that audience', async () => {
    await db.insert('staff_announcements', { title: 'Bar only', body: 'x', kind: 'general', location_id: 'c05a0000-0000-4000-8000-000000000001', positions: ['bartender'], event_id: null, requires_ack: false, published_at: NOW.toISOString(), expires_at: null, author_name: 'Alex', created_at: NOW.toISOString(), archived_at: null });
    const carlos = await feedFor(db, (await listEmployees(db)).find((employee) => employee.id === DEMO_EMPLOYEES.carlos)!, NOW);
    const jose = await feedFor(db, (await listEmployees(db)).find((employee) => employee.id === DEMO_EMPLOYEES.jose)!, NOW);
    expect(carlos.some((entry) => entry.title === 'Bar only')).toBe(true);
    expect(jose.some((entry) => entry.title === 'Bar only')).toBe(false);
  });
});
