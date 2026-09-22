import 'server-only';

import { getTicketingClient } from './db';

/**
 * Orders and tickets, read with the service role.
 *
 * Nothing here checks who is asking. The route handlers and pages do that —
 * with a signed token or a matching email — before they call in.
 */

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed';

export interface OrderItemRecord {
  id: string;
  tierId: string;
  tierName: string;
  unitPriceCents: number;
  quantity: number;
  seats: number;
  subtotalCents: number;
}

export interface TicketRecord {
  id: string;
  orderItemId: string;
  tierId: string;
  code: string;
  status: 'valid' | 'checked_in' | 'void' | 'refunded';
  seats: number;
  attendeeName: string | null;
  checkedInAt: string | null;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  eventId: string;
  status: OrderStatus;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  subtotalCents: number;
  serviceFeeCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  refundedCents: number;
  source: string;
  stripePaymentIntentId: string | null;
  consentText: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  items: OrderItemRecord[];
  tickets: TicketRecord[];
}

type Row = Record<string, unknown>;

function toOrder(row: Row, items: Row[], tickets: Row[]): OrderRecord {
  return {
    id: String(row.id),
    orderNumber: String(row.order_number),
    eventId: String(row.event_id),
    status: String(row.status) as OrderStatus,
    customerName: (row.customer_name as string | null) ?? null,
    customerEmail: (row.customer_email as string | null) ?? null,
    customerPhone: (row.customer_phone as string | null) ?? null,
    subtotalCents: Number(row.subtotal_cents ?? 0),
    serviceFeeCents: Number(row.service_fee_cents ?? 0),
    taxCents: Number(row.tax_cents ?? 0),
    discountCents: Number(row.discount_cents ?? 0),
    totalCents: Number(row.total_cents ?? 0),
    refundedCents: Number(row.refunded_cents ?? 0),
    source: String(row.source ?? 'web'),
    stripePaymentIntentId: (row.stripe_payment_intent_id as string | null) ?? null,
    consentText: (row.consent_text as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    createdAt: String(row.created_at),
    items: items.map((item) => ({
      id: String(item.id),
      tierId: String(item.tier_id),
      tierName: String(item.tier_name),
      unitPriceCents: Number(item.unit_price_cents),
      quantity: Number(item.quantity),
      seats: Number(item.seats),
      subtotalCents: Number(item.subtotal_cents),
    })),
    tickets: tickets.map((ticket) => ({
      id: String(ticket.id),
      orderItemId: String(ticket.order_item_id),
      tierId: String(ticket.tier_id),
      code: String(ticket.code),
      status: String(ticket.status) as TicketRecord['status'],
      seats: Number(ticket.seats ?? 1),
      attendeeName: (ticket.attendee_name as string | null) ?? null,
      checkedInAt: (ticket.checked_in_at as string | null) ?? null,
    })),
  };
}

async function hydrate(row: Row | null): Promise<OrderRecord | null> {
  const client = getTicketingClient();
  if (!client || !row) return null;
  const [items, tickets] = await Promise.all([
    client.from('order_items').select('*').eq('order_id', row.id as string),
    client.from('tickets').select('*').eq('order_id', row.id as string).order('created_at').order('seq'),
  ]);
  return toOrder(row, (items.data ?? []) as Row[], (tickets.data ?? []) as Row[]);
}

export async function getOrderByNumber(orderNumber: string): Promise<OrderRecord | null> {
  const client = getTicketingClient();
  if (!client) return null;
  const { data } = await client
    .from('orders')
    .select('*')
    .eq('order_number', orderNumber.trim().toUpperCase())
    .maybeSingle();
  return hydrate((data as Row | null) ?? null);
}

export async function getOrderById(id: string): Promise<OrderRecord | null> {
  const client = getTicketingClient();
  if (!client) return null;
  const { data } = await client.from('orders').select('*').eq('id', id).maybeSingle();
  return hydrate((data as Row | null) ?? null);
}

export async function getOrderByPaymentIntent(paymentIntentId: string): Promise<OrderRecord | null> {
  const client = getTicketingClient();
  if (!client) return null;
  const { data } = await client
    .from('orders')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  return hydrate((data as Row | null) ?? null);
}

/** A pending order is live only while its hold has not expired. */
export function holdIsLive(order: Pick<OrderRecord, 'status' | 'expiresAt'>, now = new Date()): boolean {
  if (order.status !== 'pending') return false;
  if (!order.expiresAt) return true;
  return Date.parse(order.expiresAt) > now.getTime();
}

export function isPaidStatus(status: OrderStatus): boolean {
  return status === 'paid' || status === 'partially_refunded';
}
