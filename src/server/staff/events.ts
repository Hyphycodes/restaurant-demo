import 'server-only';

import type { Db, Row } from '@/lib/db/types';
import { liveValues, type EditorialRow } from '@/server/content/editorial';

/**
 * The few things the staff system needs to know about an event, read
 * straight from `event_occurrences`. The public site's full resolver stays
 * the source of truth for guests; this is the lighter read a schedule, a
 * task or a staffing board needs beside a row.
 */

export interface EventSummaryLite {
  id: string;
  title: string;
  slug: string | null;
  startsAt: string;
  endsAt: string;
  doorsAt: string | null;
  locationId: string | null;
  published: boolean;
  status: string;
}

export function eventLiteFromRow(row: Row): EventSummaryLite {
  const live = liveValues(row as EditorialRow);
  return {
    id: String(row.id),
    // `||` and not `??`: a row saved with an empty title is the common
    // shape here, and "" reads as a missing event rather than a nameless one.
    title: String(live.title || row.title || 'Untitled event'),
    slug: (live.slug as string | null) ?? (row.slug as string | null) ?? null,
    startsAt: String(live.starts_at ?? row.starts_at),
    endsAt: String(live.ends_at ?? row.ends_at),
    doorsAt: (live.doors_open_at as string | null) ?? null,
    locationId: (row.location_id as string | null) ?? null,
    published: row.published !== false,
    status: String(live.status ?? 'scheduled'),
  };
}

export async function eventSummaries(db: Db, ids: string[]): Promise<Map<string, EventSummaryLite>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  try {
    const rows = await db.list<Row>('event_occurrences', { whereIn: { id: unique } });
    return new Map(rows.map((row) => [String(row.id), eventLiteFromRow(row)]));
  } catch {
    return new Map();
  }
}

/** Standalone events (not series overrides) in a window, soonest first. */
export async function listEventsBetween(db: Db, from: string, to: string, locationId: string | null = null): Promise<EventSummaryLite[]> {
  try {
    const rows = await db.list<Row>('event_occurrences', { where: { series_slug: null }, range: { column: 'starts_at', from, to }, orderBy: 'starts_at' });
    return rows
      .filter((row) => !row.archived_at)
      .map(eventLiteFromRow)
      .filter((event) => event.status !== 'cancelled')
      .filter((event) => !locationId || !event.locationId || event.locationId === locationId);
  } catch {
    return [];
  }
}

export async function getEventLite(db: Db, id: string): Promise<EventSummaryLite | null> {
  const row = await db.get<Row>('event_occurrences', id);
  return row && !row.series_slug ? eventLiteFromRow(row) : null;
}
