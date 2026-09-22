import 'server-only';

import { cache } from 'react';
import { getReadDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { assets, type AssetKind, type AssetRecord } from './assets';

/**
 * The public site's view of a photograph.
 *
 * WHY THIS EXISTS: until now `<Asset id="…">` read `src/content/assets.ts`
 * directly, so a photo swapped in the admin changed the admin and nothing else.
 * The registry stayed the real source and the Photos screen was a catalogue of
 * something it could not actually alter. Every image on the website now resolves
 * through here instead, which is what makes replacing one a real edit.
 *
 * The registry has not gone away — it is the DEFAULT, and the fallback. A record
 * in the store overrides it field by field, so:
 *
 *   - a clean checkout with no database renders exactly what it always did
 *   - a database outage degrades to the same, rather than to broken images
 *   - `npm run assets:check` still verifies the files that ship in the repo
 *
 * Only live columns are read. A draft edit to alt text is invisible to guests
 * until it is published, like every other draft.
 */

export interface PublicAsset {
  path: string | null;
  kind: AssetKind;
  /** null means decorative: renders alt="" and aria-hidden. */
  alt: string | null;
  width: number;
  height: number;
  ratio: string;
  focal: string;
  poster?: string;
  status: string;
}

function fromRegistry(entry: AssetRecord): PublicAsset {
  return {
    path: entry.path,
    kind: entry.kind,
    alt: entry.alt,
    width: entry.width,
    height: entry.height,
    ratio: entry.ratio,
    focal: entry.focal,
    poster: entry.poster,
    status: entry.status,
  };
}

const REGISTRY: Record<string, PublicAsset> = Object.fromEntries(
  Object.entries(assets as Record<string, AssetRecord>).map(([id, entry]) => [
    id,
    fromRegistry(entry),
  ]),
);

/** Supabase must answer quickly or the page renders from the registry instead. */
const QUERY_TIMEOUT_MS = 2500;

/**
 * Every media record the public site may need, resolved once per render.
 *
 * One query for the whole page rather than one per image — sixteen `<Asset>`
 * calls on the homepage would otherwise be sixteen round trips, which is the
 * N+1 the brief asks not to introduce.
 */
export async function loadMediaMap(): Promise<Record<string, PublicAsset>> {
  const db = getReadDb();
  if (!db) return REGISTRY;

  try {
    const rows = await Promise.race([
      db.list<Row>('media_assets'),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), QUERY_TIMEOUT_MS)),
    ]);
    if (!rows) return REGISTRY;

    const merged: Record<string, PublicAsset> = { ...REGISTRY };

    for (const row of rows) {
      const id = String(row.asset_id);
      const base = merged[id];

      // An archived photograph is off the website. The admin refuses to archive
      // one that is still placed, so reaching here means it was archived while
      // unused — render the placeholder rather than a broken image.
      const archived = Boolean(row.archived_at);

      merged[id] = {
        path: archived ? null : ((row.path as string | null) ?? base?.path ?? null),
        kind: ((row.kind as AssetKind) ?? base?.kind ?? 'image') as AssetKind,
        // `decorative` is the explicit choice; alt is only meaningful without it.
        alt: row.decorative ? null : ((row.alt as string | null) ?? base?.alt ?? null),
        width: Number(row.width ?? base?.width ?? 0),
        height: Number(row.height ?? base?.height ?? 0),
        ratio: String(row.ratio ?? base?.ratio ?? '1:1'),
        focal: String(row.focal ?? base?.focal ?? '50% 50%'),
        poster: (row.poster as string | undefined) ?? base?.poster,
        status: archived ? 'placeholder' : String(row.status ?? base?.status ?? 'placeholder'),
      };
    }

    return merged;
  } catch (error) {
    // A photograph is never worth taking a page down for.
    console.error('[media] falling back to the built-in registry:', error);
    return REGISTRY;
  }
}

/** Request-scoped. Sixteen `<Asset>` calls on a page share one lookup. */
export const getMediaMap = cache(loadMediaMap);

export async function getPublicAsset(id: string): Promise<PublicAsset | null> {
  const map = await getMediaMap();
  return map[id] ?? null;
}

/** `w:h` as a CSS aspect-ratio value. */
export function ratioOf(asset: Pick<PublicAsset, 'ratio' | 'width' | 'height'>): string {
  const [w, h] = asset.ratio.split(':').map(Number);
  return w && h ? `${w} / ${h}` : `${asset.width} / ${asset.height}`;
}
