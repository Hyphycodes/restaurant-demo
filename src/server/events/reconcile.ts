import 'server-only';

import { DEFAULT_PRESET, type EventCategory } from '@/content/event-presentation';
import type { Db, Row } from '@/lib/db/types';
import { storeMediaFile } from '@/server/media-files';
import type { Staff } from '@/server/auth';
import type { TickeriEvent } from './tickeri';



export interface ReconcileOptions {
  /** New events land as drafts unless the admin asks for them to go straight up. */
  publishNew: boolean;
  
  importFlyers: boolean;
}

export interface ReconcileChange {
  sourceEventId: string;
  title: string;
  startsAt: string;
  action: 'created' | 'updated' | 'unchanged';
  /** Human-readable list of what a sync actually altered. */
  changed: string[];
  
  flyerImported: boolean;
}

export interface ReconcileReport {
  changes: ReconcileChange[];
  
  missing: { id: string; title: string; startsAt: string }[];
  problems: string[];
}

/** Slug from a title, unique against what is already stored. */
function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'event'
  );
}

/**
 * A first guess at what kind of event this is, from its name.
 *
 * A guess, and labelled as one: the admin can change it in one click, and an
 * unrecognised event is left uncategorised rather than filed wrongly.
 */
export function guessCategory(title: string): EventCategory | null {
  const name = title.toLowerCase();
  if (/vinyl|vermouth|listening night|record/.test(name)) return 'vinyl-vermouth';
  if (/brunch/.test(name)) return 'brunch';
  if (/comedy|comedian|stand[-\s]?up|hosted by/.test(name)) return 'comedy';
  if (/disco|nights?|saturdays?|fridays?|dj|after hours|y2k|party/.test(name)) {
    return 'nightlife';
  }
  return null;
}


async function importFlyer(
  db: Db,
  staff: Staff,
  event: TickeriEvent,
): Promise<{ assetId: string } | { error: string }> {
  if (!event.flyerUrl) return { error: 'no flyer on the listing' };
  try {
    const response = await fetch(event.flyerUrl, { cache: 'no-store' });
    if (!response.ok) return { error: `flyer download failed (${response.status})` };

    const type = response.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/jpeg';
    const bytes = await response.arrayBuffer();
    const extension = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const file = new File([bytes], `${slugify(event.title)}-flyer.${extension}`, { type });

    const stored = await storeMediaFile({
      db,
      staff,
      file,
      title: `${event.title} — official flyer`,
      // The flyer is the event's own artwork and it carries its name, date and
      // price in the pixels; describing it is what makes it readable aloud.
      alt: `Official flyer for ${event.title}`,
      tags: ['Events'],
    });
    return stored.ok ? { assetId: stored.assetId } : { error: stored.message };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'flyer download failed' };
  }
}

/** The factual columns a sync is allowed to write. Presentation is absent by design. */
function factsOf(event: TickeriEvent): Row {
  return {
    title: event.title,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    description: event.description,
    venue_name: event.venueName,
    ticket_url: event.url,
    price_text: event.priceText,
    status: event.cancelled ? 'cancelled' : event.soldOut ? 'sold-out' : 'scheduled',
    source: 'tickeri',
    source_event_id: event.sourceEventId,
    source_url: event.url,
    synced_at: new Date().toISOString(),
  };
}

const FACT_LABEL: Record<string, string> = {
  title: 'name',
  starts_at: 'date and time',
  ends_at: 'finish time',
  description: 'description',
  venue_name: 'venue',
  ticket_url: 'ticket link',
  price_text: 'price',
  status: 'status',
};

export async function reconcileTickeri(
  db: Db,
  staff: Staff,
  events: TickeriEvent[],
  options: ReconcileOptions,
): Promise<ReconcileReport> {
  const changes: ReconcileChange[] = [];
  const problems: string[] = [];

  const existing = await db.list<Row>('event_occurrences');
  const bySource = new Map<string, Row>();
  for (const row of existing) {
    if (row.source_event_id) bySource.set(String(row.source_event_id), row);
  }
  const seen = new Set<string>();
  const usedSlugs = new Set(existing.map((row) => String(row.slug ?? '')).filter(Boolean));

  for (const event of events) {
    seen.add(event.sourceEventId);
    const facts = factsOf(event);
    const current = bySource.get(event.sourceEventId);

    if (!current) {
      let slug = slugify(event.title);
      let n = 2;
      while (usedSlugs.has(slug)) slug = `${slugify(event.title)}-${n++}`;
      usedSlugs.add(slug);

      const id = `tickeri:${event.sourceEventId}`;
      let flyerImported = false;
      let flyerAssetId: string | null = null;

      if (options.importFlyers) {
        const result = await importFlyer(db, staff, event);
        if ('assetId' in result) {
          flyerAssetId = result.assetId;
          flyerImported = true;
        } else {
          problems.push(`${event.title}: ${result.error}`);
        }
      }

      await db.upsert('event_occurrences', {
        ...facts,
        id,
        series_slug: null,
        slug,
        published: options.publishNew,
        // The imported flyer IS the official artwork for this event.
        flyer_asset_id: flyerAssetId,
        category: guessCategory(event.title),
        visual_preset: DEFAULT_PRESET,
        treatment: 'standard',
        featured: false,
        priority: 0,
        draft: null,
        archived_at: null,
      });

      changes.push({
        sourceEventId: event.sourceEventId,
        title: event.title,
        startsAt: event.startsAt,
        action: 'created',
        changed: [],
        flyerImported,
      });
      continue;
    }

    // An existing row: write only the facts that actually differ, so `updated_at`
    // and the version history mean something.
    const patch: Row = {};
    const changed: string[] = [];
    for (const [column, value] of Object.entries(facts)) {
      if (['source', 'source_event_id', 'source_url', 'synced_at'].includes(column)) continue;
      const before = current[column] ?? null;
      const after = value ?? null;
      if (column === 'starts_at' || column === 'ends_at') {
        const same =
          before && after
            ? new Date(String(before)).getTime() === new Date(String(after)).getTime()
            : before === after;
        if (same) continue;
      } else if (before === after) {
        continue;
      }
      patch[column] = value;
      changed.push(FACT_LABEL[column] ?? column);
    }

    let flyerImported = false;
    // Write-once: only an empty slot is filled, and only from the official art.
    if (options.importFlyers && !current.flyer_asset_id && event.flyerUrl) {
      const result = await importFlyer(db, staff, event);
      if ('assetId' in result) {
        patch.flyer_asset_id = result.assetId;
        changed.push('official flyer');
        flyerImported = true;
      } else {
        problems.push(`${event.title}: ${result.error}`);
      }
    }

    if (Object.keys(patch).length === 0) {
      changes.push({
        sourceEventId: event.sourceEventId,
        title: event.title,
        startsAt: event.startsAt,
        action: 'unchanged',
        changed: [],
        flyerImported: false,
      });
      continue;
    }

    patch.source = 'tickeri';
    patch.source_url = event.url;
    patch.synced_at = facts.synced_at;
    await db.update('event_occurrences', String(current.id), patch);

    changes.push({
      sourceEventId: event.sourceEventId,
      title: event.title,
      startsAt: event.startsAt,
      action: 'updated',
      changed,
      flyerImported,
    });
  }

  // Anything we imported before and Tickeri has stopped listing. Reported, never
  // removed: an event pulled from sale is a decision for a person, and a
  // transient Tickeri outage must not be able to empty the events page.
  const nowIso = new Date().toISOString();
  const missing = existing
    .filter(
      (row) =>
        row.source === 'tickeri' &&
        row.source_event_id &&
        !seen.has(String(row.source_event_id)) &&
        !row.archived_at &&
        String(row.starts_at) >= nowIso,
    )
    .map((row) => ({
      id: String(row.id),
      title: String(row.title ?? 'Untitled'),
      startsAt: String(row.starts_at),
    }));

  return { changes, missing, problems };
}
