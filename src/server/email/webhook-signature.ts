import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Standard Webhooks signature check (https://www.standardwebhooks.com).
 *
 * Both Resend (Svix) and Supabase Auth hooks sign this way: the secret is
 * `whsec_<base64>` (Supabase prefixes `v1,`), the signed content is
 * `<id>.<timestamp>.<body>`, and the signature header carries one or more
 * space-separated `v1,<base64>` values. Pure, so it is tested without a
 * server.
 */

export interface SignedHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export function svixHeaders(get: (name: string) => string | null): SignedHeaders {
  return { id: get('svix-id'), timestamp: get('svix-timestamp'), signature: get('svix-signature') };
}

export function standardHeaders(get: (name: string) => string | null): SignedHeaders {
  return { id: get('webhook-id'), timestamp: get('webhook-timestamp'), signature: get('webhook-signature') };
}

export const TOLERANCE_SECONDS = 5 * 60;

export function verifyStandardWebhook(
  body: string,
  headers: SignedHeaders,
  secret: string,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing signature headers' };
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return { ok: false, reason: 'bad timestamp' };
  if (Math.abs(now.getTime() / 1000 - seconds) > TOLERANCE_SECONDS) return { ok: false, reason: 'timestamp outside tolerance' };

  const raw = secret.trim().replace(/^v1,/, '').replace(/^whsec_/, '');
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    return { ok: false, reason: 'bad secret' };
  }
  if (key.length === 0) return { ok: false, reason: 'bad secret' };

  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  for (const part of signature.split(/\s+/)) {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) continue;
    const given = Buffer.from(value, 'base64');
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: 'signature mismatch' };
}

/** Builds a signature header for tests and for signing our own requests. */
export function signStandardWebhook(body: string, id: string, timestamp: string, secret: string): string {
  const raw = secret.trim().replace(/^v1,/, '').replace(/^whsec_/, '');
  const key = Buffer.from(raw, 'base64');
  return `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
}
