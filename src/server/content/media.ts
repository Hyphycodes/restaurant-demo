import 'server-only';

import { assets, type AssetRecord } from '@/content/assets';
import type { AdminMedia, MediaUsage } from '@/content/admin-types';
import { MEDIA_TAGS, type MediaTag } from '@/content/labels';
import type { Db, Row } from '@/lib/db/types';
import { stateOf, type EditorialRow } from './editorial';

/**
 * Media, and the references that protect it.
 *
 * The rule that matters: nothing that is still on the website can be archived or
 * deleted without being shown, by name, where it is used. Reference counting is
 * a query rather than a stored counter, because a counter is a number that can
 * be wrong; a query cannot be.
 */

export { MEDIA_TAGS };
export type { MediaTag, AdminMedia, MediaUsage };

/**
 * Every place a media asset is referenced, resolved from the actual records.
 *
 * This is why archiving is safe: the list is computed from the same rows the
 * public site reads, so it cannot disagree with what a guest would see.
 */
export async function usageOf(db: Db, assetId: string): Promise<MediaUsage[]> {
  const [series, occurrences, sections, items] = await Promise.all([
    db.list<Row>('event_series'),
    db.list<Row>('event_occurrences'),
    db.list<Row>('page_sections'),
    db.list<Row>('menu_items'),
  ]);

  const usage: MediaUsage[] = [];

  for (const row of series) {
    if (row.flyer_asset_id === assetId || row.artwork_asset_id === assetId) {
      usage.push({
        label: `${row.title} artwork`,
        href: `/admin/events/${row.slug}`,
        route: `/events/${row.slug}`,
      });
    }
  }

  for (const row of occurrences) {
    if (row.flyer_asset_id === assetId) {
      usage.push({
        label: `${row.title ?? 'One night'} — ${String(row.starts_at).slice(0, 10)}`,
        href: `/admin/events`,
        route: '/events',
      });
    }
  }

  for (const row of sections) {
    if (row.media_asset_id === assetId) {
      usage.push({
        label: `${labelPage(String(row.page))} — ${String(row.key)}`,
        href: `/admin/website/${row.page}`,
        route: routeOf(String(row.page)),
      });
    }
  }

  for (const row of items) {
    if (row.media_asset_id === assetId) {
      usage.push({ label: `Menu — ${row.name}`, href: `/admin/menu`, route: '/menu' });
    }
  }

  return usage;
}

/**
 * Public routes a design placement touches.
 *
 * A registry placement is prose written for a person — "Header", "Homepage
 * gallery", "/menu#cocktails" — not a route. This turns it into routes so that
 * swapping a design-placed photograph can refresh the pages it actually appears
 * on. It errs towards refreshing too much: a stale photograph is a real defect,
 * an extra revalidation is a few milliseconds.
 */
export function routesOfRegistryUsage(usage: string[]): string[] {
  const routes = new Set<string>();
  const ALL = ['/', '/menu', '/events', '/catering', '/private-events', '/visit', '/careers'];

  for (const entry of usage) {
    const explicit = entry.match(/\/[a-z0-9/-]+/i)?.[0].split('#')[0];
    if (explicit) {
      routes.add(explicit.replace(/\/$/, '') || '/');
      continue;
    }
    // The header and the footer are on every page, so a logo swap is site-wide.
    if (/header|footer|logo|grain/i.test(entry)) return ALL;
    if (/home|hero/i.test(entry)) routes.add('/');
    if (/menu/i.test(entry)) routes.add('/menu');
    if (/event|flyer|dark/i.test(entry)) routes.add('/events');
    if (/visit|gallery|room/i.test(entry)) routes.add('/visit');
    if (/career|team/i.test(entry)) routes.add('/careers');
    if (/catering/i.test(entry)) routes.add('/catering');
    if (/private/i.test(entry)) routes.add('/private-events');
  }

  return [...routes];
}

function labelPage(page: string): string {
  const labels: Record<string, string> = {
    home: 'Homepage',
    menu: 'Menu',
    events: 'Events',
    catering: 'Catering',
    'private-events': 'Private events',
    visit: 'Visit & contact',
    careers: 'Careers',
  };
  return labels[page] ?? page;
}

function routeOf(page: string): string {
  return page === 'home' ? '/' : `/${page}`;
}

export async function getMediaLibrary(db: Db): Promise<AdminMedia[]> {
  const rows = await db.list<Row>('media_assets', { orderBy: 'asset_id' });

  return Promise.all(
    rows.map(async (row): Promise<AdminMedia> => {
      const id = String(row.asset_id);
      const registry = (assets as Record<string, AssetRecord>)[id];
      return {
        assetId: id,
        path: (row.path as string | null) ?? null,
        title: String(row.title ?? id),
        alt: (row.alt as string | null) ?? null,
        decorative: Boolean(row.decorative),
        kind: (row.kind as AdminMedia['kind']) ?? 'image',
        width: Number(row.width ?? 0),
        height: Number(row.height ?? 0),
        ratio: String(row.ratio ?? ''),
        focal: String(row.focal ?? '50% 50%'),
        poster: (row.poster as string | null) ?? null,
        status: String(row.status ?? 'placeholder'),
        tags: (row.tags as string[]) ?? [],
        sizeBytes: (row.size_bytes as number | null) ?? null,
        mime: (row.mime as string | null) ?? null,
        durationSeconds: (row.duration_seconds as number | null) ?? null,
        state: stateOf(row as EditorialRow),
        archivedAt: (row.archived_at as string | null) ?? null,
        usage: await usageOf(db, id),
        // Placements the DESIGN fixes — a component asking for this asset by id.
        // They are not database references, so a reverse-reference query cannot
        // see them, and archiving without checking them would take a photograph
        // off a page nobody had opened.
        registryUsage: registry?.usage ?? [],
      };
    }),
  );
}

export async function getMedia(db: Db, assetId: string): Promise<AdminMedia | null> {
  const library = await getMediaLibrary(db);
  return library.find((entry) => entry.assetId === assetId) ?? null;
}

/**
 * Search across the fields a person would actually remember: what they called it,
 * what the file was called, what it shows, and its tags.
 */
export function searchMedia(library: AdminMedia[], query: string): AdminMedia[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return library;
  return library.filter((entry) =>
    [entry.title, entry.assetId, entry.path ?? '', entry.alt ?? '', entry.tags.join(' ')]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}

/** Everywhere this asset appears: chosen in the admin, or fixed by the design. */
export function totalPlacements(entry: AdminMedia): number {
  return entry.usage.length + entry.registryUsage.length;
}

/** Publication blockers for one asset, in the words the person needs to hear. */
export function mediaProblems(entry: AdminMedia): string[] {
  const problems: string[] = [];
  if (!entry.path && entry.status !== 'placeholder') {
    problems.push('The file is missing.');
  }
  if (entry.path && !entry.decorative && !entry.alt?.trim()) {
    problems.push('Needs a short description for screen readers, or mark it decorative.');
  }
  if (entry.kind === 'video' && !entry.poster) {
    problems.push('A video needs a still image to show before it plays.');
  }
  return problems;
}
