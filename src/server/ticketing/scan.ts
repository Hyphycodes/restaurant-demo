import 'server-only';

import { createHash } from 'node:crypto';
import { tokenFromScan } from '@/lib/tickets/link';
import { normalizeCode } from '@/lib/ticketing/codes';
import { isSigningConfigured, signTicketToken, verifyTicketToken } from '@/lib/ticketing/tokens';
import { getTicketingClient } from './db';

/**
 * The door, server side.
 *
 * Order of checks is the point: the signature first (a forged QR never
 * touches the database), then the event, then the ticket's state, then one
 * atomic UPDATE that only succeeds if nobody else got there first. Every
 * outcome is written to `scans`, including the invalid ones.
 */

/**
 * `invalid` is "this is not one of our codes at all" — a failed signature or
 * something that could never be a code. `not_found` is "this looks like ours
 * and matches nothing", which is a different conversation at a door.
 */
export type ScanResult =
  | 'ok'
  | 'duplicate'
  | 'invalid'
  | 'wrong_event'
  | 'void'
  | 'refunded'
  | 'not_found'
  | 'override';

export interface ScanTicket {
  id: string;
  code: string;
  tierName: string;
  seats: number;
  attendeeName: string | null;
  orderNumber: string;
  orderTickets: { id: string; code: string; status: string }[];
  checkedInAt: string | null;
  checkedInBy: string | null;
}

export interface ScanResponse {
  result: ScanResult;
  reason: string;
  ticket: ScanTicket | null;
  counts: { checkedIn: number; total: number };
}

export interface ScanInput {
  eventId: string;
  token?: string;
  code?: string;
  /**
   * A check-in staff performed from search rather than from a camera — the
   * dead-phone case. Only ever set by a manager: the route gates it, because
   * a ticket id is not evidence of holding the ticket.
   */
  ticketId?: string;
  /** Let them in anyway on a duplicate. */
  override?: boolean;
  deviceLabel?: string;
  scannedBy: string;
  /** When the scan actually happened, for queued offline scans. */
  scannedAt?: string;
}

type Row = Record<string, unknown>;

/**
 * Two doors, both offline, the same ticket. Whoever scanned it FIRST is the
 * truth, even if their phone synced second — otherwise the recorded time of
 * arrival depends on which staff member found signal first, which is exactly
 * the fact a dispute turns on.
 *
 * Returns the timestamp the check-in should be rewound to, or null to leave it
 * alone.
 */
export function earlierCheckIn(existingIso: string | null, incomingIso: string | null): string | null {
  if (!existingIso || !incomingIso) return null;
  const existing = Date.parse(existingIso);
  const incoming = Date.parse(incomingIso);
  if (!Number.isFinite(existing) || !Number.isFinite(incoming)) return null;
  return incoming < existing ? new Date(incoming).toISOString() : null;
}

export async function eventCounts(eventId: string): Promise<{ checkedIn: number; total: number }> {
  const client = getTicketingClient();
  if (!client) return { checkedIn: 0, total: 0 };
  const [total, checkedIn] = await Promise.all([
    client.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId).in('status', ['valid', 'checked_in']),
    client.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'checked_in'),
  ]);
  return { checkedIn: checkedIn.count ?? 0, total: total.count ?? 0 };
}

async function describe(ticket: Row): Promise<ScanTicket> {
  const client = getTicketingClient()!;
  const [order, item, siblings] = await Promise.all([
    client.from('orders').select('order_number, customer_name').eq('id', ticket.order_id as string).maybeSingle(),
    client.from('order_items').select('tier_name').eq('id', ticket.order_item_id as string).maybeSingle(),
    client.from('tickets').select('id, code, status').eq('order_id', ticket.order_id as string).order('created_at').order('seq'),
  ]);
  return {
    id: String(ticket.id),
    code: String(ticket.code),
    tierName: String(item.data?.tier_name ?? 'Ticket'),
    seats: Number(ticket.seats ?? 1),
    attendeeName: (ticket.attendee_name as string | null) ?? (order.data?.customer_name as string | null) ?? null,
    orderNumber: String(order.data?.order_number ?? ''),
    orderTickets: (siblings.data ?? []).map((row) => ({ id: String(row.id), code: String(row.code), status: String(row.status) })),
    checkedInAt: (ticket.checked_in_at as string | null) ?? null,
    checkedInBy: (ticket.checked_in_by as string | null) ?? null,
  };
}

/** What a result was called before migration 0015 widened the constraint. */
const LEGACY_RESULT: Partial<Record<ScanResult, ScanResult>> = {
  refunded: 'void',
  not_found: 'invalid',
};

async function record(input: ScanInput, result: ScanResult, ticketId: string | null): Promise<void> {
  const client = getTicketingClient();
  if (!client) return;
  const row = {
    ticket_id: ticketId,
    event_id: input.eventId,
    raw_code: (input.token ?? input.code ?? '').slice(0, 400),
    result,
    device_label: input.deviceLabel?.slice(0, 80) ?? null,
    scanned_by: input.scannedBy.slice(0, 120),
    scanned_at: input.scannedAt && Number.isFinite(Date.parse(input.scannedAt)) ? input.scannedAt : new Date().toISOString(),
  };
  const { error } = await client.from('scans').insert(row);
  // A database that has not had migration 0015 applied yet still has the older,
  // narrower check. The door does not care what the log calls a result, so the
  // scan is recorded under the old name rather than lost. 23514 = check
  // constraint violation.
  if (error?.code === '23514' && LEGACY_RESULT[result]) {
    await client.from('scans').insert({ ...row, result: LEGACY_RESULT[result] });
  }
}

export async function scanTicket(input: ScanInput): Promise<ScanResponse> {
  const client = getTicketingClient();
  if (!client) return { result: 'invalid', reason: 'Ticketing is not connected.', ticket: null, counts: { checkedIn: 0, total: 0 } };

  // 1. The signature, before anything else. No database for a forgery.
  let ticketRow: Row | null = null;
  if (input.token && !isSigningConfigured()) {
    // Nothing has been signed, so nothing can be checked. Say so plainly
    // instead of throwing at a door.
    return { result: 'invalid', reason: 'Ticket signing is not set up yet.', ticket: null, counts: await eventCounts(input.eventId) };
  }
  if (input.token) {
    // The QR carries a URL; a scanner app may hand back the URL, the bare
    // token, or the URL with its own query string bolted on.
    const verified = verifyTicketToken(tokenFromScan(input.token) ?? input.token);
    if (!verified) {
      await record(input, 'invalid', null);
      return { result: 'invalid', reason: 'Not a real ticket code.', ticket: null, counts: await eventCounts(input.eventId) };
    }
    if (verified.eid !== input.eventId) {
      await record(input, 'wrong_event', verified.tid);
      return { result: 'wrong_event', reason: 'This ticket is for a different event.', ticket: null, counts: await eventCounts(input.eventId) };
    }
    const { data } = await client.from('tickets').select('*').eq('id', verified.tid).maybeSingle();
    ticketRow = (data as Row | null) ?? null;
  } else if (input.ticketId) {
    const { data } = await client.from('tickets').select('*').eq('id', input.ticketId).maybeSingle();
    ticketRow = (data as Row | null) ?? null;
  } else if (input.code) {
    const clean = normalizeCode(input.code);
    if (clean.length !== 8) {
      await record(input, 'invalid', null);
      return { result: 'invalid', reason: 'A ticket code is eight characters.', ticket: null, counts: await eventCounts(input.eventId) };
    }
    const { data } = await client.from('tickets').select('*').eq('code', `${clean.slice(0, 4)}-${clean.slice(4)}`).maybeSingle();
    ticketRow = (data as Row | null) ?? null;
  }

  if (!ticketRow) {
    await record(input, 'not_found', null);
    return { result: 'not_found', reason: 'No ticket with that code.', ticket: null, counts: await eventCounts(input.eventId) };
  }
  const ticketId = String(ticketRow.id);

  // 2. The event, then the state.
  if (ticketRow.event_id !== input.eventId) {
    await record(input, 'wrong_event', ticketId);
    return { result: 'wrong_event', reason: 'This ticket is for a different event.', ticket: await describe(ticketRow), counts: await eventCounts(input.eventId) };
  }
  if (ticketRow.status === 'void' || ticketRow.status === 'refunded') {
    const { data: order } = await client.from('orders').select('status').eq('id', ticketRow.order_id as string).maybeSingle();
    // Money back and cancelled are told apart: one is a guest who asked for a
    // refund, the other is a ticket staff pulled. They are not the same
    // conversation at the door, so they are not the same result.
    const refunded = ticketRow.status === 'refunded' || order?.status === 'refunded' || order?.status === 'partially_refunded';
    const reason =
      order?.status === 'disputed' ? 'The payment on this order was disputed.'
        : refunded ? 'This ticket was refunded.'
          : 'This ticket was cancelled.';
    const result: ScanResult = refunded ? 'refunded' : 'void';
    await record(input, result, ticketId);
    return { result, reason, ticket: await describe(ticketRow), counts: await eventCounts(input.eventId) };
  }

  // 3. Let them in anyway: an explicit judgement call on a duplicate.
  if (input.override) {
    await client.from('tickets').update({ checked_in_override: true }).eq('id', ticketId);
    await record(input, 'override', ticketId);
    return { result: 'override', reason: 'Let in on a second scan.', ticket: await describe(ticketRow), counts: await eventCounts(input.eventId) };
  }

  // 4. Atomic check-in. Zero rows means somebody else scanned it first.
  const now = new Date().toISOString();
  const { data: updated } = await client
    .from('tickets')
    .update({ status: 'checked_in', checked_in_at: input.scannedAt && Number.isFinite(Date.parse(input.scannedAt)) ? input.scannedAt : now, checked_in_by: input.scannedBy })
    .eq('id', ticketId)
    .is('checked_in_at', null)
    .select('*');

  if (!updated || updated.length === 0) {
    const { data: fresh } = await client.from('tickets').select('*').eq('id', ticketId).maybeSingle();
    const row = (fresh as Row | null) ?? ticketRow;

    const rewind = earlierCheckIn(row.checked_in_at ? String(row.checked_in_at) : null, input.scannedAt ?? null);
    if (rewind) {
      await client.from('tickets').update({ checked_in_at: rewind, checked_in_by: input.scannedBy }).eq('id', ticketId);
      row.checked_in_at = rewind;
      row.checked_in_by = input.scannedBy;
    }

    await record(input, 'duplicate', ticketId);
    return { result: 'duplicate', reason: 'Already scanned.', ticket: await describe(row), counts: await eventCounts(input.eventId) };
  }

  await record(input, 'ok', ticketId);
  return { result: 'ok', reason: 'Welcome in.', ticket: await describe(updated[0] as Row), counts: await eventCounts(input.eventId) };
}

/** Everything the scanner needs to work with the wifi down. */
export async function scanManifest(eventId: string) {
  const client = getTicketingClient();
  if (!client) return null;
  const [event, tickets, orders] = await Promise.all([
    client.from('event_occurrences').select('id, title, starts_at').eq('id', eventId).maybeSingle(),
    client.from('tickets').select('id, code, status, seats, attendee_name, order_id, order_item_id').eq('event_id', eventId),
    client.from('orders').select('id, order_number, customer_name, status').eq('event_id', eventId),
  ]);
  if (!event.data) return null;
  const orderById = new Map((orders.data ?? []).map((row) => [String(row.id), row]));
  const itemIds = [...new Set((tickets.data ?? []).map((row) => String(row.order_item_id)))];
  const tierByItem = new Map<string, string>();
  if (itemIds.length) {
    const { data } = await client.from('order_items').select('id, tier_name').in('id', itemIds);
    for (const row of data ?? []) tierByItem.set(String(row.id), String(row.tier_name));
  }
  const sizeByOrder = new Map<string, number>();
  for (const row of tickets.data ?? []) sizeByOrder.set(String(row.order_id), (sizeByOrder.get(String(row.order_id)) ?? 0) + 1);

  const manifest = {
    eventId: String(event.data.id),
    eventTitle: String(event.data.title),
    fetchedAt: new Date().toISOString(),
    tickets: (tickets.data ?? []).map((row) => {
      const order = orderById.get(String(row.order_id));
      const disputed = order?.status === 'disputed' || order?.status === 'refunded';
      return {
        id: String(row.id),
        tokenHash: createHash('sha256').update(signTicketToken(String(row.id), eventId)).digest('hex'),
        codeHash: createHash('sha256').update(normalizeCode(String(row.code))).digest('hex'),
        tierName: tierByItem.get(String(row.order_item_id)) ?? 'Ticket',
        status: (disputed && row.status !== 'checked_in' ? 'void' : String(row.status)) as 'valid' | 'checked_in' | 'void' | 'refunded',
        seats: Number(row.seats ?? 1),
        orderNumber: String(order?.order_number ?? ''),
        orderSize: sizeByOrder.get(String(row.order_id)) ?? 1,
        attendeeName: (row.attendee_name as string | null) ?? (order?.customer_name as string | null) ?? null,
      };
    }),
  };
  return { manifest, counts: await eventCounts(eventId) };
}

/* --------------------------------------------------------------- search -- */

export interface AttendeeMatch {
  ticketId: string;
  code: string;
  name: string | null;
  email: string | null;
  tierName: string;
  orderNumber: string;
  status: string;
  checkedInAt: string | null;
  seats: number;
}

/**
 * Somebody at the door whose phone is dead, or who cannot find the email.
 *
 * Name, email or order number. `withEmail` is false for door staff: they can
 * find a guest and let them in without being handed the customer list.
 */
export async function searchAttendees(
  eventId: string,
  query: string,
  { withEmail = false, limit = 20 }: { withEmail?: boolean; limit?: number } = {},
): Promise<AttendeeMatch[]> {
  const client = getTicketingClient();
  const term = query.trim();
  if (!client || term.length < 2) return [];

  const like = `%${term.replace(/[%_]/g, (match) => `\\${match}`)}%`;
  const fields = ['order_number.ilike.' + like, 'attendee_name.ilike.' + like, 'customer_name.ilike.' + like, 'code.ilike.' + like];
  if (withEmail) fields.push('customer_email.ilike.' + like);

  const { data } = await client
    .from('event_attendees')
    .select('ticket_id, code, attendee_name, customer_name, customer_email, tier_name, order_number, ticket_status, checked_in_at, seats, order_status')
    .eq('event_id', eventId)
    .or(fields.join(','))
    .limit(limit);

  return (data ?? [])
    .filter((row) => row.order_status !== 'canceled' && row.order_status !== 'failed')
    .map((row) => ({
      ticketId: String(row.ticket_id),
      code: String(row.code),
      name: (row.attendee_name as string | null) ?? (row.customer_name as string | null) ?? null,
      email: withEmail ? ((row.customer_email as string | null) ?? null) : null,
      tierName: String(row.tier_name ?? 'Ticket'),
      orderNumber: String(row.order_number ?? ''),
      status: String(row.ticket_status),
      checkedInAt: (row.checked_in_at as string | null) ?? null,
      seats: Number(row.seats ?? 1),
    }));
}
