import 'server-only';

import type { ShiftRequest, ShiftRequestKind, ShiftRequestStatus } from '@/content/staff-types';
import type { Db, Row } from '@/lib/db/types';
import type { Staff } from '@/server/auth';
import { employeeMap } from './employees';
import { getShift, reassignShift, scheduleContext, shiftFromRow, toShiftView } from './schedule';

/**
 * Shift coverage: give up, swap, or ask for cover.
 *
 * The flow is the one in the brief. Carlos offers his Saturday. Everyone
 * eligible sees it. Maria claims it. A manager approves, and only then does
 * the schedule change — through `reassignShift`, so the history shows Carlos
 * had it. The request row keeps its own trail alongside.
 */

export async function listShiftRequests(db: Db, filter: { status?: ShiftRequestStatus[]; employeeId?: string; open?: boolean } = {}): Promise<ShiftRequest[]> {
  const rows = await db.list<Row>('shift_requests', { orderBy: 'created_at', desc: true });
  const wanted = rows
    .filter((row) => !filter.status || filter.status.includes(row.status as ShiftRequestStatus))
    .filter((row) => !filter.employeeId || row.requested_by === filter.employeeId || row.claimed_by === filter.employeeId)
    .filter((row) => !filter.open || row.status === 'open');
  if (wanted.length === 0) return [];
  const shiftIds = [...new Set(wanted.flatMap((row) => [String(row.shift_id), row.swap_shift_id ? String(row.swap_shift_id) : null]).filter((id): id is string => Boolean(id)))];
  const shiftRows = await db.list<Row>('shifts', { whereIn: { id: shiftIds } });
  const shifts = new Map(shiftRows.map((row) => [String(row.id), shiftFromRow(row)]));
  const context = await scheduleContext(db, shiftRows.map((row) => row.event_id as string | null).filter((id): id is string => Boolean(id)));
  const employees = await employeeMap(db);
  return wanted
    .map((row) => {
      const shift = shifts.get(String(row.shift_id));
      if (!shift) return null;
      const swap = row.swap_shift_id ? shifts.get(String(row.swap_shift_id)) ?? null : null;
      return {
        id: String(row.id),
        shift: toShiftView(shift, context),
        kind: row.kind as ShiftRequestKind,
        requestedBy: String(row.requested_by),
        requestedByName: employees.get(String(row.requested_by))?.displayName ?? 'Employee',
        swapShift: swap ? toShiftView(swap, context) : null,
        claimedBy: (row.claimed_by as string | null) ?? null,
        claimedByName: row.claimed_by ? (employees.get(String(row.claimed_by))?.displayName ?? 'Employee') : null,
        claimedAt: (row.claimed_at as string | null) ?? null,
        status: row.status as ShiftRequestStatus,
        note: (row.note as string | null) ?? null,
        decisionNote: (row.decision_note as string | null) ?? null,
        createdAt: String(row.created_at ?? ''),
      } satisfies ShiftRequest;
    })
    .filter((request): request is ShiftRequest => request !== null);
}

export async function openShiftRequest(db: Db, employeeId: string, input: { shiftId: string; kind: ShiftRequestKind; note: string | null; swapShiftId: string | null }): Promise<Row> {
  const shift = await getShift(db, input.shiftId);
  if (!shift || shift.employeeId !== employeeId) throw new Error('You can only offer your own shift.');
  if (shift.status !== 'published') throw new Error('Only a published shift can be offered.');
  if (Date.parse(shift.startsAt) < Date.now()) throw new Error('That shift has already started.');
  const existing = await db.list<Row>('shift_requests', { where: { shift_id: input.shiftId } });
  if (existing.some((row) => row.status === 'open' || row.status === 'claimed')) throw new Error('This shift is already offered.');
  return db.insert<Row>('shift_requests', {
    shift_id: input.shiftId,
    kind: input.kind,
    requested_by: employeeId,
    swap_shift_id: input.swapShiftId,
    status: 'open',
    note: input.note,
    created_at: new Date().toISOString(),
  });
}

/**
 * Picking up an open shift. It becomes a claimed request rather than a
 * straight reassignment, so a manager still approves it and the trail reads
 * the same as any other coverage change.
 */
export async function claimOpenShift(db: Db, employeeId: string, shiftId: string): Promise<Row> {
  const shift = await getShift(db, shiftId);
  if (!shift) throw new Error('That shift no longer exists.');
  if (shift.employeeId) throw new Error('That shift is no longer open.');
  if (shift.status !== 'published') throw new Error('That shift is not published.');
  if (Date.parse(shift.startsAt) < Date.now()) throw new Error('That shift has already started.');
  const existing = await db.list<Row>('shift_requests', { where: { shift_id: shiftId } });
  if (existing.some((row) => row.status === 'open' || row.status === 'claimed')) {
    throw new Error('Someone already asked for this shift. A manager will decide.');
  }
  return db.insert<Row>('shift_requests', {
    shift_id: shiftId,
    kind: 'cover',
    requested_by: employeeId,
    claimed_by: employeeId,
    claimed_at: new Date().toISOString(),
    status: 'claimed',
    note: 'Picked up an open shift',
    created_at: new Date().toISOString(),
  });
}

export async function claimShiftRequest(db: Db, employeeId: string, requestId: string): Promise<Row> {
  const row = await db.get<Row>('shift_requests', requestId);
  if (!row || row.status !== 'open') throw new Error('That shift has already been taken.');
  if (row.requested_by === employeeId) throw new Error('That is your own shift.');
  return db.update<Row>('shift_requests', requestId, { status: 'claimed', claimed_by: employeeId, claimed_at: new Date().toISOString() });
}

export async function withdrawShiftRequest(db: Db, employeeId: string, requestId: string): Promise<void> {
  const row = await db.get<Row>('shift_requests', requestId);
  if (!row || row.requested_by !== employeeId) throw new Error('That request is not yours.');
  if (row.status !== 'open' && row.status !== 'claimed') throw new Error('That request is already decided.');
  await db.update('shift_requests', requestId, { status: 'cancelled' });
}

/** Approval moves the shift. Denial leaves it where it was. */
export async function decideShiftRequest(db: Db, requestId: string, status: 'approved' | 'denied', note: string | null, actor: Staff): Promise<{ before: Row; after: Row }> {
  const row = await db.get<Row>('shift_requests', requestId);
  if (!row) throw new Error('That request no longer exists.');
  if (row.status !== 'open' && row.status !== 'claimed') throw new Error('That request is already decided.');
  if (status === 'approved') {
    if (row.kind === 'give_up' && !row.claimed_by) {
      // Nobody took it: approving a give-up opens the shift.
      await reassignShift(db, String(row.shift_id), null, actor, `given up by request ${requestId}`);
    } else {
      if (!row.claimed_by) throw new Error('Nobody has claimed this shift yet.');
      await reassignShift(db, String(row.shift_id), String(row.claimed_by), actor, `coverage approved (request ${requestId})`);
      if (row.kind === 'swap' && row.swap_shift_id) {
        await reassignShift(db, String(row.swap_shift_id), String(row.requested_by), actor, `swap approved (request ${requestId})`);
      }
    }
  }
  const after = await db.update<Row>('shift_requests', requestId, {
    status,
    decided_by: actor.source === 'supabase' ? actor.id : null,
    decided_at: new Date().toISOString(),
    decision_note: note,
  });
  return { before: row, after };
}
