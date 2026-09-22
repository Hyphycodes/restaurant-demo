import 'server-only';
import { DEMO_MODE } from '@/lib/demo';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';



let client: SupabaseClient | null | undefined;
let readClient: SupabaseClient | null | undefined;

function buildClient(key: string): SupabaseClient | null {
  if (DEMO_MODE) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { 'x-cosa-nostra-source': 'ticketing' },
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
        }),
    },
  });
}

/** Service-role only. Every write (reserve, fulfil, refund, scan, admin reads of orders/tickets) goes through this. */
export function getTicketingClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  client = key ? buildClient(key) : null;
  return client;
}

/** Service role if present, otherwise the anon key. Use only for reads Postgres already grants to anon. */
export function getTicketingReadClient(): SupabaseClient | null {
  const withService = getTicketingClient();
  if (withService) return withService;
  if (readClient !== undefined) return readClient;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  readClient = anon ? buildClient(anon) : null;
  return readClient;
}

export function isTicketingConfigured(): boolean {
  return getTicketingClient() !== null;
}

/**
 * The error codes `reserve_order` raises, and what to tell a guest.
 *
 * The code is the exception message; PostgREST relays it verbatim. Anything
 * not listed is an unexpected failure and gets the generic line.
 */
export const RESERVE_ERRORS: Record<string, string> = {
  EVENT_NOT_FOUND: 'That event is not on sale.',
  EVENT_NOT_ON_SALE: 'Tickets for this event are not on sale right now.',
  EVENT_PAST: 'This event has already happened.',
  NO_ITEMS: 'Choose at least one ticket.',
  TIER_NOT_FOUND: 'One of those tickets is no longer offered. Refresh and try again.',
  TIER_CLOSED: 'That ticket is not on sale right now.',
  MIN_PER_ORDER: 'That ticket has a minimum per order.',
  MAX_PER_ORDER: 'That is more of that ticket than one order can take.',
  TIER_SOLD_OUT: 'Those just sold out while you were deciding. Here is what is left.',
  EVENT_SOLD_OUT: 'The last seats just went. Here is what is left.',
  PROMO_INVALID: 'That code is not valid for this event.',
  ORDER_NOT_FOUND: 'That order could not be found.',
};

/** The reserve error code inside a PostgREST error message, if any. */
export function reserveErrorCode(message: string): string | null {
  const match = /\b([A-Z]+(?:_[A-Z]+)+)\b/.exec(message);
  return match && match[1]! in RESERVE_ERRORS ? match[1]! : null;
}
