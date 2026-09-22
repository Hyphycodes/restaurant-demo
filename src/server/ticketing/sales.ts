import 'server-only';
import { DEMO_MODE } from '@/lib/demo';
import { getReadDb } from '@/lib/db';

import { getTicketingClient } from './db';

/**
 * What the admin reads about money. All of it comes from the two views in
 * migration 0007, through the service role; nothing is assembled from
 * counters in TypeScript.
 */

export interface SalesSummary {
  eventId: string;
  ticketsSold: number;
  seatsTaken: number;
  checkedIn: number;
  capacity: number | null;
  grossCents: number;
  refundedCents: number;
  netCents: number;
  webCents: number;
  doorCents: number;
  ordersCount: number;
  compOrders: number;
  lastSaleAt: string | null;
}

type Row = Record<string, unknown>;

function toSummary(row: Row): SalesSummary {
  return {
    eventId: String(row.event_id),
    ticketsSold: Number(row.tickets_sold ?? 0),
    seatsTaken: Number(row.seats_taken ?? 0),
    checkedIn: Number(row.checked_in ?? 0),
    capacity: typeof row.capacity === 'number' ? row.capacity : null,
    grossCents: Number(row.gross_cents ?? 0),
    refundedCents: Number(row.refunded_cents ?? 0),
    netCents: Number(row.net_cents ?? 0),
    webCents: Number(row.web_cents ?? 0),
    doorCents: Number(row.door_cents ?? 0),
    ordersCount: Number(row.orders_count ?? 0),
    compOrders: Number(row.comp_orders ?? 0),
    lastSaleAt: (row.last_sale_at as string | null) ?? null,
  };
}

/** Summaries for a set of events, keyed by event id. Missing ids simply are not present. Never throws. */
export async function getSalesSummaries(eventIds: string[]): Promise<Map<string, SalesSummary>> {
  if (DEMO_MODE) {
    const result=new Map<string,SalesSummary>();
    for(const id of eventIds){const orders=await listOrders(id);const cents=orders.reduce((sum,o)=>sum+o.totalCents,0);result.set(id,{eventId:id,ticketsSold:18,seatsTaken:18,checkedIn:0,capacity:60,grossCents:cents,refundedCents:0,netCents:cents,webCents:cents,doorCents:0,ordersCount:orders.length,compOrders:0,lastSaleAt:new Date().toISOString()});}
    return result;
  }
  const client = getTicketingClient();
  if (!client || eventIds.length === 0) return new Map();
  try {
    const { data, error } = await client.from('event_sales_summary').select('*').in('event_id', eventIds);
    if (error) return new Map();
    return new Map((data as Row[]).map((row) => [String(row.event_id), toSummary(row)]));
  } catch {
    return new Map();
  }
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: string;
  source: string;
  customerName: string | null;
  customerEmail: string | null;
  totalCents: number;
  refundedCents: number;
  paidAt: string | null;
  createdAt: string;
  stripePaymentIntentId: string | null;
  items: { tierName: string; quantity: number }[];
  tickets: { code: string; status: string }[];
}

/** Every completed order for an event, newest first, with tiers and tickets. */
export async function listOrders(eventId: string, query = ''): Promise<AdminOrder[]> {
  if(DEMO_MODE){
    const tiers=await getReadDb()?.list<Row>('ticket_tiers',{where:{event_id:eventId}})??[];
    if(!tiers.length)return [];
    return ['Jamie Morgan','Avery Brooks','Taylor Lane','Jordan Ellis','Cameron West','Riley Quinn'].map((name,i)=>({id:`demo-order-${i}`,orderNumber:`CN-DEMO-${1001+i}`,status:'paid',source:'web',customerName:name,customerEmail:`guest${i+1}@example.invalid`,totalCents:Number(tiers[0]?.price_cents??2800)*3,refundedCents:0,paidAt:new Date().toISOString(),createdAt:new Date().toISOString(),stripePaymentIntentId:null,items:[{tierName:'Supper Club Admission',quantity:3}],tickets:[{code:`DEMO-${i+1}-A`,status:'valid'}]})).filter(o=>!query||`${o.customerName} ${o.orderNumber}`.toLowerCase().includes(query.toLowerCase()));
  }
  const client = getTicketingClient();
  if (!client) return [];
  const { data: orders } = await client
    .from('orders')
    .select('*')
    .eq('event_id', eventId)
    .in('status', ['paid', 'partially_refunded', 'refunded', 'disputed'])
    .order('paid_at', { ascending: false, nullsFirst: false })
    .limit(500);
  const rows = (orders ?? []) as Row[];
  const ids = rows.map((row) => String(row.id));
  if (ids.length === 0) return [];
  const [items, tickets] = await Promise.all([
    client.from('order_items').select('order_id, tier_name, quantity').in('order_id', ids),
    client.from('tickets').select('order_id, code, status').in('order_id', ids).order('created_at'),
  ]);
  const needle = query.trim().toLowerCase();
  return rows
    .map((row) => ({
      id: String(row.id),
      orderNumber: String(row.order_number),
      status: String(row.status),
      source: String(row.source ?? 'web'),
      customerName: (row.customer_name as string | null) ?? null,
      customerEmail: (row.customer_email as string | null) ?? null,
      totalCents: Number(row.total_cents ?? 0),
      refundedCents: Number(row.refunded_cents ?? 0),
      paidAt: (row.paid_at as string | null) ?? null,
      createdAt: String(row.created_at),
      stripePaymentIntentId: (row.stripe_payment_intent_id as string | null) ?? null,
      items: ((items.data ?? []) as Row[]).filter((item) => item.order_id === row.id).map((item) => ({ tierName: String(item.tier_name), quantity: Number(item.quantity) })),
      tickets: ((tickets.data ?? []) as Row[]).filter((ticket) => ticket.order_id === row.id).map((ticket) => ({ code: String(ticket.code), status: String(ticket.status) })),
    }))
    .filter((order) =>
      !needle ||
      (order.customerName ?? '').toLowerCase().includes(needle) ||
      (order.customerEmail ?? '').toLowerCase().includes(needle) ||
      order.orderNumber.toLowerCase().includes(needle),
    );
}

export interface Attendee {
  name: string;
  email: string;
  tierName: string;
  code: string;
  orderNumber: string;
  source: string;
  status: string;
  checkedInAt: string | null;
}

/** The door list, one row per ticket. */
export async function listAttendees(eventId: string): Promise<Attendee[]> {
  if(DEMO_MODE)return (await listOrders(eventId)).flatMap(o=>Array.from({length:3},(_,i)=>({name:o.customerName??'Sample guest',email:o.customerEmail??'',tierName:'Supper Club Admission',code:`${o.orderNumber}-${i+1}`,orderNumber:o.orderNumber,source:'web',status:'valid',checkedInAt:null})));
  const client = getTicketingClient();
  if (!client) return [];
  const { data } = await client.from('event_attendees').select('*').eq('event_id', eventId).order('attendee_name');
  return ((data ?? []) as Row[]).map((row) => ({
    name: String(row.attendee_name ?? row.customer_name ?? ''),
    email: String(row.customer_email ?? ''),
    tierName: String(row.tier_name ?? ''),
    code: String(row.code ?? ''),
    orderNumber: String(row.order_number ?? ''),
    source: String(row.source ?? 'web'),
    status: String(row.ticket_status ?? ''),
    checkedInAt: (row.checked_in_at as string | null) ?? null,
  }));
}

export function toCsv(rows: Attendee[]): string {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const header = ['Name', 'Email', 'Ticket', 'Code', 'Order', 'Source', 'Status', 'Checked in'];
  const lines = rows.map((row) =>
    [row.name, row.email, row.tierName, row.code, row.orderNumber, row.source, row.status, row.checkedInAt ?? ''].map(escape).join(','),
  );
  return [header.join(','), ...lines].join('\r\n');
}
