import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailLogType } from '@/emails/registry';
import { getTicketingClient } from '@/server/ticketing/db';

/**
 * `email_log`: one row per attempt, and what the provider said afterwards.
 *
 * Written for two readers. Staff, asking "did her ticket go?" — answered by
 * `statusForOrders` on the Sales screen. And the Resend webhook, which finds
 * the row by provider id and marks it delivered or bounced.
 *
 * Written to work on a database that has not had migration 0018 yet: the
 * insert is tried with every column, and on "no such column" or "value not
 * allowed" (the older, narrower type check) it is retried with the 0009
 * shape. A missing migration must never lose the record of a send.
 */

export type EmailLogStatus = 'sent' | 'failed' | 'skipped' | 'delivered' | 'delayed' | 'bounced' | 'complained';

export interface EmailLogEntry {
  type: EmailLogType;
  to: string | null;
  status: 'sent' | 'failed' | 'skipped';
  orderId?: string | null;
  eventId?: string | null;
  template?: string | null;
  subject?: string | null;
  providerId?: string | null;
  error?: string | null;
  isTest?: boolean;
}

export interface EmailLogRow {
  id: string;
  type: string;
  toEmail: string | null;
  status: string;
  orderId: string | null;
  eventId: string | null;
  template: string | null;
  subject: string | null;
  providerId: string | null;
  error: string | null;
  isTest: boolean;
  createdAt: string;
  deliveredAt: string | null;
  lastEventAt: string | null;
}

/** The types the 0009/0017 constraint accepts, for the fallback insert. */
const LEGACY_TYPES = new Set(['confirmation', 'reminder', 'resend', 'tonight', 'thanks', 'owner_alert', 'cancellation']);

type Row = Record<string, unknown>;

function toRow(row: Row): EmailLogRow {
  return {
    id: String(row.id),
    type: String(row.type),
    toEmail: (row.to_email as string | null) ?? null,
    status: String(row.status),
    orderId: (row.order_id as string | null) ?? null,
    eventId: (row.event_id as string | null) ?? null,
    template: (row.template as string | null) ?? null,
    subject: (row.subject as string | null) ?? null,
    providerId: (row.provider_id as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    isTest: Boolean(row.is_test),
    createdAt: String(row.created_at),
    deliveredAt: (row.delivered_at as string | null) ?? null,
    lastEventAt: (row.last_event_at as string | null) ?? null,
  };
}

export interface EmailStore {
  log(entry: EmailLogEntry): Promise<void>;
  /** Has a `sent` email of this type already gone for this order? */
  hasSent(orderId: string, type: EmailLogType): Promise<boolean>;
}

/** 42703 = undefined column, 23514 = check violation, 42P01 = undefined table. */
function isSchemaError(code: string | undefined): boolean {
  return code === '42703' || code === '23514' || code === 'PGRST204';
}

export function supabaseEmailStore(client: SupabaseClient): EmailStore {
  return {
    async log(entry) {
      const full = {
        order_id: entry.orderId ?? null,
        type: entry.type,
        to_email: entry.to,
        provider_id: entry.providerId ?? null,
        status: entry.status,
        error: entry.error?.slice(0, 1000) ?? null,
        event_id: entry.eventId ?? null,
        template: entry.template ?? null,
        subject: entry.subject?.slice(0, 300) ?? null,
        is_test: entry.isTest ?? false,
      };
      const { error } = await client.from('email_log').insert(full);
      if (!error) return;
      if (!isSchemaError(error.code)) {
        console.error('[email] could not write email_log:', error.message);
        return;
      }
      // Pre-0018 database: the 0009 columns, and a type the old check allows.
      const legacyType = LEGACY_TYPES.has(entry.type) ? entry.type : entry.type === 'event_update' ? 'cancellation' : 'owner_alert';
      const note = LEGACY_TYPES.has(entry.type) ? '' : ` [${entry.type}${entry.isTest ? ', test' : ''}]`;
      const fallback = await client.from('email_log').insert({
        order_id: entry.orderId ?? null,
        type: legacyType,
        to_email: entry.to,
        provider_id: entry.providerId ?? null,
        status: entry.status,
        error: `${entry.error ?? ''}${note}`.slice(0, 1000) || null,
      });
      if (fallback.error) console.error('[email] could not write email_log (legacy shape):', fallback.error.message);
    },
    async hasSent(orderId, type) {
      const { data } = await client
        .from('email_log')
        .select('id')
        .eq('order_id', orderId)
        .eq('type', type)
        .in('status', ['sent', 'delivered', 'delayed'])
        .limit(1);
      return Boolean(data?.length);
    },
  };
}

export function emailStore(): EmailStore | null {
  const client = getTicketingClient();
  return client ? supabaseEmailStore(client) : null;
}

/** The latest attempts, newest first. For the Communications screen. */
export async function recentEmailLog(limit = 50, filter: { orderId?: string; eventId?: string } = {}): Promise<EmailLogRow[]> {
  const client = getTicketingClient();
  if (!client) return [];
  let query = client.from('email_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (filter.orderId) query = query.eq('order_id', filter.orderId);
  if (filter.eventId) query = query.eq('event_id', filter.eventId);
  const { data, error } = await query;
  if (error) return [];
  return ((data ?? []) as Row[]).map(toRow);
}

export interface OrderEmailStatus {
  /** The most recent confirmation or resend attempt. */
  latest: EmailLogRow | null;
  /** Something of any type has reached `sent`/`delivered`. */
  anySent: boolean;
  attempts: number;
}

/** For each order: what the ticket email did. One query for a whole Sales page. */
export async function statusForOrders(orderIds: string[]): Promise<Map<string, OrderEmailStatus>> {
  const client = getTicketingClient();
  const result = new Map<string, OrderEmailStatus>();
  if (!client || orderIds.length === 0) return result;
  const { data, error } = await client
    .from('email_log')
    .select('*')
    .in('order_id', orderIds)
    .in('type', ['confirmation', 'resend'])
    .order('created_at', { ascending: false });
  if (error) return result;
  for (const raw of (data ?? []) as Row[]) {
    const row = toRow(raw);
    if (!row.orderId) continue;
    const current = result.get(row.orderId) ?? { latest: null, anySent: false, attempts: 0 };
    current.attempts += 1;
    if (!current.latest) current.latest = row;
    if (['sent', 'delivered', 'delayed'].includes(row.status)) current.anySent = true;
    result.set(row.orderId, current);
  }
  return result;
}

/** What a Resend delivery event does to the row it names. Returns false when no row matched. */
export async function recordDeliveryEvent(providerId: string, status: EmailLogStatus, at: string, detail: string | null): Promise<boolean> {
  const client = getTicketingClient();
  if (!client) return false;
  const patch: Row = { status, last_event_at: at, provider_status: detail };
  if (status === 'delivered') patch.delivered_at = at;
  const { data, error } = await client.from('email_log').update(patch).eq('provider_id', providerId).select('id');
  if (error) {
    if (isSchemaError(error.code)) {
      // Pre-0018: only the status column exists, and only the three original values.
      const legacy = status === 'delivered' || status === 'delayed' ? 'sent' : 'failed';
      const retry = await client.from('email_log').update({ status: legacy, error: detail }).eq('provider_id', providerId).select('id');
      return Boolean(retry.data?.length);
    }
    console.error('[email] could not record delivery event:', error.message);
    return false;
  }
  return Boolean(data?.length);
}
