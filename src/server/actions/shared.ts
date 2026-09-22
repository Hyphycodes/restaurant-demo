import 'server-only';

import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/content/admin-types';
import { getWriteDb } from '@/lib/db';
import type { Db } from '@/lib/db/types';
import { requireCapability, type Capability, type Staff } from '../auth';

/**
 * The shape every admin mutation returns, and the harness they all run through.
 *
 * Three things happen here so they cannot be forgotten in an individual action:
 *
 *   1. the capability is checked BEFORE a database handle is even obtained;
 *   2. a thrown error becomes a sentence a person can act on, never a stack
 *      trace or a Postgres error code;
 *   3. only the routes the change actually affects are revalidated.
 */

export type { ActionState };

export const IDLE: ActionState = { ok: true, message: '' };


export const AFFECTED: Record<string, { routes: string[]; subtrees?: string[] }> = {
  menu: { routes: ['/menu', '/'] },
  events: { routes: ['/events', '/'], subtrees: ['/events'] },
  catering: { routes: ['/catering', '/'] },
  // Address, phone, hours and links appear in the footer of every page.
  settings: { routes: ['/', '/visit', '/contact', '/menu', '/catering', '/private-events', '/careers', '/talent'], subtrees: ['/events'] },
  home: { routes: ['/'] },
  media: { routes: [] },
  // The seasonal theme wraps every public page.
  theme: {
    routes: ['/', '/menu', '/events', '/catering', '/private-events', '/visit', '/contact', '/careers', '/talent', '/legal/privacy'],
    subtrees: ['/events'],
  },
  hubs: { routes: ['/links'], subtrees: ['/go'] },
};

export function revalidate(area: keyof typeof AFFECTED): string[] {
  const entry = AFFECTED[area];
  if (!entry) return [];
  for (const route of entry.routes) revalidatePath(route);
  for (const subtree of entry.subtrees ?? []) revalidatePath(subtree, 'layout');
  return entry.routes;
}

export interface ActionContext {
  db: Db;
  staff: Staff;
}

/**
 * Runs an admin mutation.
 *
 * A missing database is a refusal, not a silent success — that is what stops a
 * production deployment without Supabase from accepting edits into nowhere.
 */
export async function run(
  capability: Capability,
  job: (context: ActionContext) => Promise<ActionState>,
): Promise<ActionState> {
  try {
    const staff = await requireCapability(capability);
    const db = await getWriteDb();
    if (!db) {
      return {
        ok: false,
        message:
          'The content system is not connected, so nothing can be saved yet. A developer needs to finish the setup in docs/ENVIRONMENT.md.',
      };
    }
    return await job({ db, staff });
  } catch (error) {
    return { ok: false, message: friendly(error) };
  }
}

/**
 * Turns whatever went wrong into something a restaurant manager can act on.
 *
 * Postgres speaks in constraint names and SQLSTATEs. A person standing in a
 * kitchen needs to know what to change.
 */
export function friendly(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (/permission|not allowed|cannot publish|42501/i.test(raw)) {
    return raw.includes('draft')
      ? raw
      : 'Your account cannot make that change. Ask a manager or the owner.';
  }
  if (/menu_items_price_or_note/i.test(raw)) {
    return 'An item needs either a price or a note explaining why there is not one.';
  }
  if (/media_assets_alt_or_decorative/i.test(raw)) {
    return 'Add a short description of the photo, or mark it as decorative.';
  }
  if (/media_assets_video_poster/i.test(raw)) {
    return 'A video needs a still image to show before it plays.';
  }
  if (/event_occurrences_duration|event_series_duration/i.test(raw)) {
    return 'The finish time has to be after the start time.';
  }
  if (/duplicate key|already exists|unique/i.test(raw)) {
    return 'Something with that name already exists. Try a different one.';
  }
  if (/violates foreign key/i.test(raw)) {
    return 'Something else is still using this, so it cannot be removed yet.';
  }
  if (/was not found|no longer exists/i.test(raw)) {
    return 'That item no longer exists. Refresh the page.';
  }
  if (/fetch failed|network|timeout|ECONN/i.test(raw)) {
    return 'Could not reach the content system. Check your connection and try again.';
  }
  return raw || 'Something went wrong. Please try again.';
}

/**
 * `ok` with a message, and the routes worth offering to open.
 *
 * The admin subtree is always revalidated, not only the public routes: without it
 * the list you just edited keeps rendering the old value until you navigate away,
 * and "did that save?" is the fastest way to lose someone's trust in a tool.
 */
export function done(
  message: string,
  area?: keyof typeof AFFECTED,
  /**
   * Routes this particular change touched, on top of the area's usual ones.
   *
   * A photograph is the case that needs it: which pages a swapped image appears
   * on depends on where it happens to be placed, so the routes are computed from
   * the live references rather than listed in a table here.
   */
  extraRoutes: string[] = [],
): ActionState {
  const base = area ? revalidate(area) : [];
  for (const route of extraRoutes) revalidatePath(route);
  revalidatePath('/admin', 'layout');
  const affected = [...new Set([...base, ...extraRoutes])];
  return { ok: true, message, affected: affected.length > 0 ? affected : undefined };
}

/** Saved, but nothing public changed — a draft. Only the admin needs refreshing. */
export function saved(message: string): ActionState {
  revalidatePath('/admin', 'layout');
  return { ok: true, message };
}
