import 'server-only';
import { DEMO_MODE } from '@/lib/demo';

import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Server-only Supabase clients.
 *
 * `import 'server-only'` makes it a build error for any client component to pull
 * this module in — which is what actually keeps the service-role key out of the
 * browser bundle. Hiding it behind a naming convention would not.
 */

/**
 * `env()` returns undefined for a variable that is missing, blank, or
 * whitespace-only. A hosting provider will happily hand you a defined-but-empty
 * variable, and treating that as configured is how you get a runtime throw
 * instead of a clean fallback.
 */
function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/** Rejects a value that is set but not actually a usable http(s) URL. */
function validUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new global.URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
}

const URL = validUrl(env('NEXT_PUBLIC_SUPABASE_URL'));
const ANON = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SERVICE = env('SUPABASE_SERVICE_ROLE_KEY');

export function isSupabaseConfigured(): boolean {
  if (DEMO_MODE) return false;
  return Boolean(URL && ANON);
}

/**
 * Elevated client for reading published public content during SSR.
 * Falls back to the anon key when no service key is present — public content is
 * readable by `anon` under RLS anyway, so this still works on a minimal setup.
 */
export function getServiceClient(): SupabaseClient | null {
  if (DEMO_MODE) return null;
  if (!URL) return null;
  const key = SERVICE ?? ANON;
  if (!key) return null;

  return createClient(URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { 'x-casa-aurelia-source': 'ssr' },
      fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) }),
    },
  });
}

/** Request-scoped client that carries the signed-in user's session. */
export async function getSessionClient() {
  if (DEMO_MODE) return null;
  if (!URL || !ANON) return null;
  const cookieStore = await cookies();

  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (entries: { name: string; value: string; options?: Record<string, unknown> }[]) => {
        try {
          for (const { name, value, options } of entries) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render; middleware refreshes instead.
        }
      },
    },
  });
}
