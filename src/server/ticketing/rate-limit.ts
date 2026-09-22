import 'server-only';

import { getTicketingClient } from './db';

/**
 * Shared rate limiting, failing open.
 *
 * The count lives in Postgres (`rate_limit_hit`), because serverless
 * instances share nothing and an in-memory map only limits the instance that
 * happened to answer. If the database cannot be reached the caller is let
 * through: a limiter is a nuisance filter, and blocking a real buyer because
 * of it would cost more than any abuse it stops.
 */
export async function overLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const client = getTicketingClient();
  if (!client) return false;
  try {
    const { data, error } = await client.rpc('rate_limit_hit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

/** The best identifier a public request gives us. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'local';
}
