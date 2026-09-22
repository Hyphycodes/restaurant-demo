import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signed tokens, two kinds, one secret.
 *
 *   order link   `o1.<base64url(json)>.<sig>`  — lets the buyer open their
 *                tickets page for 30 days without a login. An order number
 *                alone is never enough.
 *   ticket QR    `t1.<base64url({tid, eid, v:1})>.<sig>` — what the door scans.
 *                A forged QR fails the signature check offline, with no
 *                database lookup.
 *
 * HMAC-SHA256 over the payload, keyed by TICKET_SIGNING_SECRET. The version
 * prefix exists so the scheme can change later without breaking old tickets
 * in one go.
 */

export interface OrderToken {
  oid: string;
  /** Unix seconds. */
  exp: number;
}

export interface TicketToken {
  tid: string;
  eid: string;
  v: 1;
}

export const ORDER_TOKEN_DAYS = 30;

function secret(): string {
  const value = process.env.TICKET_SIGNING_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error('TICKET_SIGNING_SECRET must be set to at least 32 characters.');
  }
  return value;
}

export function isSigningConfigured(): boolean {
  return (process.env.TICKET_SIGNING_SECRET?.trim().length ?? 0) >= 32;
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(prefix: string, payload: string, key: string = secret()): string {
  return createHmac('sha256', key).update(`${prefix}.${payload}`).digest('base64url');
}

function verify(token: string, prefix: string, key: string = secret()): unknown | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== prefix) return null;
  const [, payload, signature] = parts as [string, string, string];
  const expected = sign(prefix, payload, key);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function signOrderToken(orderId: string, now = new Date(), key?: string): string {
  const exp = Math.floor(now.getTime() / 1000) + ORDER_TOKEN_DAYS * 86_400;
  const payload = encode({ oid: orderId, exp } satisfies OrderToken);
  return `o1.${payload}.${sign('o1', payload, key)}`;
}

/** The order id the token vouches for, or null when it is forged or expired. */
export function verifyOrderToken(token: string, now = new Date(), key?: string): string | null {
  const data = verify(token, 'o1', key) as OrderToken | null;
  if (!data || typeof data.oid !== 'string' || typeof data.exp !== 'number') return null;
  if (data.exp * 1000 < now.getTime()) return null;
  return data.oid;
}

export function signTicketToken(ticketId: string, eventId: string, key?: string): string {
  const payload = encode({ tid: ticketId, eid: eventId, v: 1 } satisfies TicketToken);
  return `t1.${payload}.${sign('t1', payload, key)}`;
}

/** The ticket and event a QR vouches for, or null. No database involved. */
export function verifyTicketToken(token: string, key?: string): TicketToken | null {
  const data = verify(token.trim(), 't1', key) as TicketToken | null;
  if (!data || typeof data.tid !== 'string' || typeof data.eid !== 'string' || data.v !== 1) return null;
  return data;
}

// The shape check lives in `@/lib/tickets/link`, which the browser can import;
// this module cannot be, because of node:crypto. Re-exported so server callers
// have one obvious place to look.
export { isTicketToken } from '@/lib/tickets/link';

/** A one-day link that lets staff open a draft event on the real page. */
export function signPreviewToken(eventId: string, now = new Date(), key?: string): string {
  const exp = Math.floor(now.getTime() / 1000) + 86_400;
  const payload = encode({ oid: eventId, exp } satisfies OrderToken);
  return `p1.${payload}.${sign('p1', payload, key)}`;
}

export function verifyPreviewToken(token: string, now = new Date(), key?: string): string | null {
  const data = verify(token, 'p1', key) as OrderToken | null;
  if (!data || typeof data.oid !== 'string' || typeof data.exp !== 'number') return null;
  if (data.exp * 1000 < now.getTime()) return null;
  return data.oid;
}
