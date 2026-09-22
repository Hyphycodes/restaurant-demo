import 'server-only';

import { getTicketingClient } from './db';
import { getSalesSummaries, type SalesSummary } from './sales';

/**
 * What the owner reads: the door as it happens, the customer list, what each
 * promoter actually brought, and the evidence behind a disputed charge.
 *
 * Everything here is computed from orders, tickets and scans at read time. No
 * counter is stored anywhere, for the same reason availability is not: a
 * counter and the rows it counts disagree eventually, and the night they
 * disagree is the night somebody is turned away at a door that says there is
 * room.
 */

type Row = Record<string, unknown>;

/* ------------------------------------------------------------------ door -- */

export interface DoorCheckIn {
  ticketId: string;
  name: string | null;
  tierName: string;
  at: string;
  door: string | null;
}

export interface DoorSnapshot {
  checkedIn: number;
  issued: number;
  /** Seats, not tickets: a table for four is four people through the door. */
  seatsIn: number;
  notArrived: number;
  capacity: number | null;
  recent: DoorCheckIn[];
  /** Only for owner and manager. Null for door staff. */
  money: Pick<SalesSummary, 'grossCents' | 'netCents' | 'webCents' | 'doorCents' | 'ordersCount' | 'compOrders'> | null;
  at: string;
}

export async function doorSnapshot(eventId: string, { withMoney }: { withMoney: boolean }): Promise<DoorSnapshot | null> {
  const client = getTicketingClient();
  if (!client) return null;

  const [{ data: tickets }, { data: recent }, summaries] = await Promise.all([
    client.from('tickets').select('id, status, seats').eq('event_id', eventId),
    client
      .from('event_attendees')
      .select('ticket_id, attendee_name, customer_name, tier_name, checked_in_at, checked_in_by')
      .eq('event_id', eventId)
      .eq('ticket_status', 'checked_in')
      .order('checked_in_at', { ascending: false })
      .limit(12),
    withMoney ? getSalesSummaries([eventId]) : Promise.resolve(new Map<string, SalesSummary>()),
  ]);

  const live = (tickets ?? []).filter((row) => row.status === 'valid' || row.status === 'checked_in');
  const checkedIn = live.filter((row) => row.status === 'checked_in');
  const summary = summaries.get(eventId) ?? null;

  const { data: event } = await client.from('event_occurrences').select('capacity').eq('id', eventId).maybeSingle();

  return {
    checkedIn: checkedIn.length,
    issued: live.length,
    seatsIn: checkedIn.reduce((total, row) => total + Number(row.seats ?? 1), 0),
    notArrived: live.length - checkedIn.length,
    capacity: typeof event?.capacity === 'number' ? event.capacity : null,
    recent: (recent ?? []).map((row: Row) => ({
      ticketId: String(row.ticket_id),
      name: (row.attendee_name as string | null) ?? (row.customer_name as string | null) ?? null,
      tierName: String(row.tier_name ?? 'Ticket'),
      at: String(row.checked_in_at),
      door: (row.checked_in_by as string | null) ?? null,
    })),
    money:
      withMoney && summary
        ? {
            grossCents: summary.grossCents,
            netCents: summary.netCents,
            webCents: summary.webCents,
            doorCents: summary.doorCents,
            ordersCount: summary.ordersCount,
            compOrders: summary.compOrders,
          }
        : null,
    at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------- customers -- */

export interface CustomerRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  marketingOptIn: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  orders: number;
  tickets: number;
  spendCents: number;
  events: number;
}


export async function listCustomers(query = '', limit = 200): Promise<CustomerRow[]> {
  const client = getTicketingClient();
  if (!client) return [];

  let customers = client.from('customers').select('*').order('last_seen_at', { ascending: false }).limit(limit);
  const term = query.trim();
  if (term.length >= 2) {
    const like = `%${term.replace(/[%_]/g, (match) => `\\${match}`)}%`;
    customers = customers.or(`email.ilike.${like},name.ilike.${like},phone.ilike.${like}`);
  }
  const { data: rows } = await customers;
  if (!rows?.length) return [];

  const ids = rows.map((row) => String(row.id));
  const { data: orders } = await client
    .from('orders')
    .select('customer_id, event_id, total_cents, refunded_cents, status')
    .in('customer_id', ids)
    .in('status', ['paid', 'partially_refunded', 'refunded', 'disputed']);
  const { data: tickets } = await client
    .from('tickets')
    .select('order_id, status, orders!inner(customer_id)')
    .in('orders.customer_id', ids);

  const byCustomer = new Map<string, { orders: number; spend: number; events: Set<string> }>();
  for (const order of orders ?? []) {
    const key = String(order.customer_id);
    const entry = byCustomer.get(key) ?? { orders: 0, spend: 0, events: new Set<string>() };
    entry.orders += 1;
    entry.spend += Number(order.total_cents ?? 0) - Number(order.refunded_cents ?? 0);
    entry.events.add(String(order.event_id));
    byCustomer.set(key, entry);
  }

  const ticketCount = new Map<string, number>();
  for (const ticket of (tickets ?? []) as Row[]) {
    const owner = (ticket.orders as { customer_id?: string } | null)?.customer_id;
    if (!owner || ticket.status === 'void') continue;
    ticketCount.set(String(owner), (ticketCount.get(String(owner)) ?? 0) + 1);
  }

  return rows.map((row) => {
    const totals = byCustomer.get(String(row.id));
    return {
      id: String(row.id),
      email: String(row.email),
      name: (row.name as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      marketingOptIn: Boolean(row.marketing_opt_in),
      firstSeenAt: String(row.first_seen_at),
      lastSeenAt: String(row.last_seen_at),
      orders: totals?.orders ?? 0,
      tickets: ticketCount.get(String(row.id)) ?? 0,
      spendCents: totals?.spend ?? 0,
      events: totals?.events.size ?? 0,
    };
  });
}

/* ------------------------------------------------------------- promoters -- */

export interface PromoterRow {
  code: string;
  promoterName: string | null;
  kind: string;
  orders: number;
  ticketsSold: number;
  grossCents: number;
  checkedIn: number;
}

/**
 * Per code: what it sold, what it grossed, and — the number that matters —
 * how many of those people actually walked in. A promoter whose codes sell
 * forty tickets and deliver twelve guests is a different conversation from one
 * whose forty all show up.
 */
export async function promoterReport(eventId: string): Promise<PromoterRow[]> {
  const client = getTicketingClient();
  if (!client) return [];

  const { data: codes } = await client.from('promo_codes').select('id, code, promoter_name, kind').or(`event_id.eq.${eventId},event_id.is.null`);
  if (!codes?.length) return [];

  const { data: orders } = await client
    .from('orders')
    .select('id, promo_code_id, total_cents, refunded_cents')
    .eq('event_id', eventId)
    .in('status', ['paid', 'partially_refunded', 'disputed'])
    .not('promo_code_id', 'is', null);
  if (!orders?.length) return [];

  const orderIds = orders.map((order) => String(order.id));
  const { data: tickets } = await client.from('tickets').select('order_id, status').in('order_id', orderIds);

  const rows: PromoterRow[] = [];
  for (const code of codes) {
    const mine = orders.filter((order) => String(order.promo_code_id) === String(code.id));
    if (mine.length === 0) continue;
    const mineIds = new Set(mine.map((order) => String(order.id)));
    const theirs = (tickets ?? []).filter((ticket) => mineIds.has(String(ticket.order_id)) && ticket.status !== 'void');
    rows.push({
      code: String(code.code),
      promoterName: (code.promoter_name as string | null) ?? null,
      kind: String(code.kind),
      orders: mine.length,
      ticketsSold: theirs.length,
      grossCents: mine.reduce((total, order) => total + Number(order.total_cents ?? 0) - Number(order.refunded_cents ?? 0), 0),
      checkedIn: theirs.filter((ticket) => ticket.status === 'checked_in').length,
    });
  }
  return rows.sort((a, b) => b.grossCents - a.grossCents);
}

/* -------------------------------------------------------------- disputes -- */

/**
 * What Stripe asks for when a guest disputes a charge, in one block to copy
 * into their form. A timestamped check-in is the single most useful thing
 * here: it says the person walked in.
 */
export async function disputeEvidence(orderId: string): Promise<string | null> {
  const client = getTicketingClient();
  if (!client) return null;

  const { data: order } = await client.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return null;
  const [{ data: tickets }, { data: emails }, { data: scans }, { data: event }] = await Promise.all([
    client.from('tickets').select('code, status, checked_in_at, checked_in_by').eq('order_id', orderId).order('seq'),
    client.from('email_log').select('type, status, to_email, provider_id, created_at').eq('order_id', orderId).order('created_at'),
    client.from('scans').select('result, scanned_at, device_label').in('ticket_id', ((await client.from('tickets').select('id').eq('order_id', orderId)).data ?? []).map((row) => String(row.id))),
    client.from('event_occurrences').select('title, starts_at').eq('id', String(order.event_id)).maybeSingle(),
  ]);

  const money = (cents: unknown) => `$${(Number(cents ?? 0) / 100).toFixed(2)}`;
  const lines = [
    `Order ${String(order.order_number)} — ${String(event?.title ?? order.event_id)}`,
    `Event date: ${event?.starts_at ? new Date(String(event.starts_at)).toUTCString() : 'unknown'}`,
    `Purchased: ${order.paid_at ? new Date(String(order.paid_at)).toUTCString() : 'not recorded'}`,
    `Customer: ${String(order.customer_name ?? 'not given')} · ${String(order.customer_email ?? 'not given')}${order.customer_phone ? ` · ${String(order.customer_phone)}` : ''}`,
    `Charged: ${money(order.total_cents)} (${String(order.currency ?? 'usd').toUpperCase()}), refunded ${money(order.refunded_cents)}`,
    `Stripe payment intent: ${String(order.stripe_payment_intent_id ?? 'none')}`,
    '',
    'Tickets issued:',
    ...(tickets ?? []).map(
      (ticket) =>
        `  ${String(ticket.code)} — ${String(ticket.status)}${ticket.checked_in_at ? `, admitted ${new Date(String(ticket.checked_in_at)).toUTCString()}${ticket.checked_in_by ? ` by ${String(ticket.checked_in_by)}` : ''}` : ''}`,
    ),
    '',
    'Scans recorded:',
    ...((scans ?? []).length
      ? (scans ?? []).map((scan) => `  ${new Date(String(scan.scanned_at)).toUTCString()} — ${String(scan.result)}${scan.device_label ? ` at ${String(scan.device_label)}` : ''}`)
      : ['  none']),
    '',
    'Ticket email:',
    ...((emails ?? []).length
      ? (emails ?? []).map(
          (entry) => `  ${new Date(String(entry.created_at)).toUTCString()} — ${String(entry.type)} ${String(entry.status)} to ${String(entry.to_email ?? '')}${entry.provider_id ? ` (${String(entry.provider_id)})` : ''}`,
        )
      : ['  none recorded']),
    '',
    `Terms agreed at purchase: ${String(order.consent_text ?? 'not recorded')}`,
  ];
  return lines.join('\n');
}
