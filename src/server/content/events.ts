import 'server-only';

import { cache } from 'react';
import { isFreeHouseNight } from '@/content/admission';
import { eventSeries as staticSeries, oneTimeEvents } from '@/content/events';
import type { EventSeries, EventStatus } from '@/content/types';
import { getReadDb } from '@/lib/db';
import type { Db, Row } from '@/lib/db/types';
import { occurrenceFromSeed, type EventInput, type OccurrenceRecord } from '@/lib/events';
import {
  DEFAULT_PRESET,
  isEventCategory,
  isEventTreatment,
  isVisualPreset,
} from '@/content/event-presentation';
import { DEFAULT_TICKETING, type EventDetails, type EventPresentation, type EventProvenance, type EventTicketing } from '@/content/types';
import { liveValues, workingValues, type EditorialRow } from './editorial';

/**
 * The presentation columns, read off any row that carries them.
 *
 * Lenient on purpose, exactly like the theme config: an unrecognised category or
 * preset becomes "not set" rather than throwing, because a typo in one event's
 * styling must never be able to take the events page down.
 */
function presentationFromRow(source: Row): EventPresentation {
  return {
    category: isEventCategory(source.category) ? source.category : null,
    priceText: (source.price_text as string | null) ?? null,
    // Three separate slots. None of them is the flyer.
    keyArtAssetId: (source.key_art_asset_id as string | null) ?? null,
    keyArtMobileAssetId: (source.key_art_mobile_asset_id as string | null) ?? null,
    foregroundAssetId: (source.foreground_asset_id as string | null) ?? null,
    visualPreset: isVisualPreset(source.visual_preset) ? source.visual_preset : DEFAULT_PRESET,
    featured: Boolean(source.featured),
    priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : 0,
    treatment: isEventTreatment(source.treatment) ? source.treatment : 'standard',
    takeoverStartAt: (source.takeover_start_at as string | null) ?? null,
    takeoverEndAt: (source.takeover_end_at as string | null) ?? null,
  };
}

function ticketingFromRow(source: Row): EventTicketing {
  const agePolicy = source.age_policy;
  return {
    enabled: Boolean(source.ticketing_enabled),
    capacity: typeof source.capacity === 'number' ? source.capacity : null,
    agePolicy: agePolicy === 'all_ages' || agePolicy === '18+' || agePolicy === '21+' ? agePolicy : null,
    refundPolicy: (source.refund_policy as string | null) ?? null,
    venueAddress: (source.venue_address as string | null) ?? null,
    doorsOpenAt: (source.doors_open_at as string | null) ?? null,
    feeDisplay: source.fee_display === 'itemized' ? 'itemized' : 'inclusive',
    taxRateBps: Number(source.tax_rate_bps ?? DEFAULT_TICKETING.taxRateBps) || 0,
    serviceFeeBps: Number(source.service_fee_bps ?? 0) || 0,
    serviceFeeFlatCents: Number(source.service_fee_flat_cents ?? 0) || 0,
  };
}

function detailsFromRow(source: Row): EventDetails {
  const hint = source.accent_hint;
  return {
    descriptionHtml: (source.description_html as string | null) ?? null,
    includedText: (source.included_text as string | null) ?? null,
    bringText: (source.bring_text as string | null) ?? null,
    arrivalText: (source.arrival_text as string | null) ?? null,
    accentHint: typeof hint === 'string' && /^#[0-9a-f]{6}$/i.test(hint) ? hint : null,
  };
}

function provenanceFromRow(source: Row): EventProvenance {
  return {
    source: source.source === 'tickeri' ? 'tickeri' : 'manual',
    sourceEventId: (source.source_event_id as string | null) ?? null,
    sourceUrl: (source.source_url as string | null) ?? null,
    syncedAt: (source.synced_at as string | null) ?? null,
  };
}

/**
 * Loading events for the selector.
 *
 * `published` decides which side of the draft line a caller sees, and it is the
 * only difference between the public site and the admin. A public read never
 * looks at `draft`, so there is no path by which an unpublished edit reaches a
 * guest — including through the homepage, which uses the same loader.
 */

type Mode = 'published' | 'working';

function seriesFromRow(row: Row, mode: Mode): EventSeries {
  const source = mode === 'working' ? workingValues(row as EditorialRow) : liveValues(row as EditorialRow);
  const cadence = String(source.cadence ?? 'one-time');
  const weekday = cadence.startsWith('weekly:') ? Number(cadence.split(':')[1]) : null;

  return {
    slug: String(source.slug),
    title: String(source.title ?? ''),
    summary: String(source.summary ?? ''),
    description: String(source.description ?? ''),
    cadence:
      weekday === null
        ? { kind: 'one-time' }
        : { kind: 'weekly', weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6 },
    startMinutes: Number(source.start_minutes ?? 0),
    endMinutes: Number(source.end_minutes ?? 0),
    ageMin: (source.age_min as number | null) ?? null,
    ageNote: (source.age_note as string | null) ?? null,
    musicFormats: (source.music_formats as string[]) ?? [],
    venueName: String(source.venue_name ?? 'Cosa Nostra'),
    artworkAssetId: (source.artwork_asset_id as string | null) ?? null,
    flyerAssetId: (source.flyer_asset_id as string | null) ?? null,
    flyerPrintedDate: (source.flyer_printed_date as string | null) ?? null,
    ticketUrl: isFreeHouseNight(String(source.slug)) ? null : (source.ticket_url as string | null) ?? null,
    priceCents: isFreeHouseNight(String(source.slug)) ? 0 : (source.price_cents as number | null) ?? null,
    status: (source.status as EventStatus) ?? 'scheduled',
    seriesEndsOn: (source.series_ends_on as string | null) ?? null,
    paused: Boolean(source.paused),
    archivedAt: (source.archived_at as string | null) ?? null,
    ticketPolicy: isFreeHouseNight(String(source.slug)) ? 'free' : (source.ticket_policy as EventSeries['ticketPolicy']) ?? 'required',
    presentation: presentationFromRow(source),
  };
}

function occurrenceFromRow(row: Row, mode: Mode): OccurrenceRecord {
  const source = mode === 'working' ? workingValues(row as EditorialRow) : liveValues(row as EditorialRow);
  return {
    id: String(source.id),
    seriesSlug: (source.series_slug as string | null) ?? null,
    startsAt: String(source.starts_at),
    endsAt: (source.ends_at as string | null) ?? null,
    status: (source.status as EventStatus | null) ?? null,
    published: source.published !== false,
    archivedAt: (source.archived_at as string | null) ?? null,
    ticketUrl: (source.ticket_url as string | null) ?? null,
    ticketLabel: (source.ticket_label as string | null) ?? null,
    priceCents: (source.price_cents as number | null) ?? null,
    title: (source.title as string | null) ?? null,
    slug: (source.slug as string | null) ?? null,
    summary: (source.summary as string | null) ?? null,
    description: (source.description as string | null) ?? null,
    ageMin: (source.age_min as number | null) ?? null,
    ageNote: (source.age_note as string | null) ?? null,
    musicFormats: (source.music_formats as string[] | null) ?? null,
    venueName: (source.venue_name as string | null) ?? null,
    flyerAssetId: (source.flyer_asset_id as string | null) ?? null,
    note: (source.note as string | null) ?? null,
    presentation: presentationFromRow(source),
    provenance: provenanceFromRow(source),
    ticketing: ticketingFromRow(source),
    details: detailsFromRow(source),
  };
}

/** The typed static content, used when no database is reachable. */
function staticInput(): EventInput {
  return { series: staticSeries, occurrences: oneTimeEvents.map(occurrenceFromSeed) };
}

async function load(db: Db, mode: Mode): Promise<EventInput> {
  const [seriesRows, occurrenceRows] = await Promise.all([
    db.list<Row>('event_series', { orderBy: 'sort' }),
    db.list<Row>('event_occurrences', { orderBy: 'starts_at' }),
  ]);


  return {
    series: seriesRows
      .map((row) => seriesFromRow(row, mode))
      .filter((series) => mode === 'working' || !series.archivedAt),
    occurrences: occurrenceRows
      .map((row) => occurrenceFromRow(row, mode))
      .filter((occurrence) => mode === 'working' || !occurrence.archivedAt),
  };
}

/**
 * Published events, for the public site. Cached per render.
 *
 * A database failure degrades to the typed static content rather than taking the
 * page down — the same rule `resolve.ts` has followed since the first build.
 */
export const getPublicEvents = cache(async (): Promise<EventInput> => {
  const db = getReadDb();
  if (!db) return staticInput();
  try {
    return await load(db, 'published');
  } catch (error) {
    console.error('[events] content unavailable:', error);
    // An outage must not resurrect events staff have cancelled or unpublished.
    return { series: [], occurrences: [] };
  }
});

/** Everything, drafts included. Admin only — never call this from a public page. */
export async function getEditableEvents(db: Db): Promise<EventInput> {
  return load(db, 'working');
}

export { seriesFromRow, occurrenceFromRow };
