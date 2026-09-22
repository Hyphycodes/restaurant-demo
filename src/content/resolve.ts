import 'server-only';

import { cache } from 'react';
import { getReadDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getPublicMenu, getPublicMenus } from '@/server/content/menu';
import { liveValues, type EditorialRow } from '@/server/content/editorial';
import { cateringItems, cateringPackages } from './catering';
import { announcements, site } from './site';
import type {
  Announcement,
  CateringItem,
  CateringPackage,
  Menu,
  MenuSlug,
  SiteSettings,
  TemporaryClosure,
} from './types';

/**
 * THE CONTENT RESOLUTION RULE (PLAN.md §1.1)
 *
 *   component -> resolve.ts -> database (if configured AND reachable)
 *                           -> static TS modules (always, as fallback)
 *
 * Consequences that matter:
 *  - The public site cannot go blank because the CMS is down or misconfigured.
 *  - `git clone && npm i && npm run dev` works with zero configuration.
 *  - The static modules double as the seed for both databases.
 *
 * Every function here is wrapped in React `cache` so a single render never issues
 * the same query twice. Nothing here ever reads a `draft` column: the editorial
 * split lives in `src/server/content/editorial.ts` and public reads take the live
 * values only, which is what makes draft leakage structurally impossible.
 */

const QUERY_TIMEOUT_MS = 2500;

async function withFallback<T>(
  label: string,
  query: () => Promise<T | null>,
  fallback: T,
): Promise<T> {
  const db = getReadDb();
  if (!db) return fallback;

  try {
    const result = await Promise.race([
      query(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), QUERY_TIMEOUT_MS)),
    ]);
    return result ?? fallback;
  } catch (error) {
    // Never throw from a content read. A CMS outage degrades to static content;
    // it does not take the restaurant's website offline.
    console.error(`[content] ${label} failed, serving static fallback:`, error);
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Business facts, in one place.
 *
 * `payload` is a SPARSE override of the typed defaults, so an untouched install
 * renders exactly what `src/content/site.ts` says and nothing is duplicated.
 * Date-specific exceptions are merged in from `special_hours`, which is why the
 * homepage, /visit and the footer can never disagree about whether we are open.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> =>
  withFallback(
    'site settings',
    async () => {
      const db = getReadDb();
      if (!db) return null;

      const [row, exceptions] = await Promise.all([
        db.get<Row>('site_settings', 'default'),
        db.list<Row>('special_hours', { orderBy: 'on_date' }),
      ]);

      const merged: SiteSettings = {
        ...site,
        ...((row?.payload as Partial<SiteSettings>) ?? {}),
      };

      const today = new Date().toISOString().slice(0, 10);
      const closures: TemporaryClosure[] = exceptions
        // A holiday that has passed is history, not a notice.
        .filter((entry) => String(entry.on_date) >= today)
        .map((entry) => ({
          id: String(entry.id),
          date: String(entry.on_date),
          reason: String(entry.note ?? 'Special hours'),
          allDay: Boolean(entry.closed),
        }));

      return { ...merged, temporaryClosures: closures.length ? closures : merged.temporaryClosures };
    },
    site,
  ),
);

export const getAnnouncements = cache(async (): Promise<Announcement[]> =>
  withFallback(
    'announcements',
    async () => {
      const db = getReadDb();
      if (!db) return null;
      const rows = await db.list<Row>('announcements', {
        where: { enabled: true },
        orderBy: 'created_at',
        desc: true,
      });
      return rows.map(
        (row): Announcement => ({
          id: String(row.id),
          message: String(row.message),
          href: (row.href as string | null) ?? null,
          linkLabel: (row.link_label as string | null) ?? null,
          startsAt: (row.starts_at as string | null) ?? null,
          endsAt: (row.ends_at as string | null) ?? null,
          enabled: Boolean(row.enabled),
          tone: (row.tone as Announcement['tone']) ?? 'default',
        }),
      );
    },
    announcements,
  ),
);

/** Menus come from the menu service, which owns the hidden/archived filtering. */
export const getMenu = cache(async (slug: MenuSlug): Promise<Menu> => getPublicMenu(slug));

export const getAllMenus = cache(async (): Promise<Menu[]> => getPublicMenus());

export const getCateringPackages = cache(async (): Promise<CateringPackage[]> =>
  withFallback(
    'catering packages',
    async () => {
      const db = getReadDb();
      if (!db) return null;
      const rows = await db.list<Row>('catering_packages', { orderBy: 'sort' });
      const live = rows.filter((row) => !row.archived_at);
      if (live.length === 0) return null;
      return live.map((row): CateringPackage => {
        const source = liveValues(row as EditorialRow);
        return {
          id: String(source.id),
          name: String(source.name),
          servesMin: (source.serves_min as number | null) ?? null,
          servesMax: (source.serves_max as number | null) ?? null,
          priceCents: Number(source.price_cents ?? 0),
          includes: (source.includes as string[]) ?? [],
        };
      });
    },
    cateringPackages,
  ),
);

export const getCateringItems = cache(async (): Promise<CateringItem[]> =>
  withFallback(
    'catering items',
    async () => {
      const db = getReadDb();
      if (!db) return null;
      const rows = await db.list<Row>('catering_items', { orderBy: 'sort' });
      const live = rows.filter((row) => !row.archived_at);
      if (live.length === 0) return null;
      return live.map((row): CateringItem => {
        const source = liveValues(row as EditorialRow);
        return {
          id: String(source.id),
          name: String(source.name),
          priceCents: Number(source.price_cents ?? 0),
          note: (source.note as string | null) ?? null,
        };
      });
    },
    cateringItems,
  ),
);
