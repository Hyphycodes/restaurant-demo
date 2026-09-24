import 'server-only';

import type { Db, Row } from '@/lib/db/types';
import { getReadDb } from '@/lib/db';
import { getPublicEvents } from '@/server/content/events';
import { getUpcomingEvents } from '@/lib/events';
import { formatEventDate, formatTimeRange } from '@/lib/format';
import { resolveManyEventArtwork } from '@/server/content/event-art';
import { site } from '@/content/site';
import { resolveScheduledMode } from '@/features/link-hubs/scheduling';
import type {
  HubEditorData,
  HubEventCard,
  HubMediaAsset,
  HubPageData,
  LinkHub,
  LinkHubBlock,
  LinkHubLocation,
  LinkHubMode,
} from '@/features/link-hubs/types';

function locationFromRow(row: Row): LinkHubLocation {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    address: (row.address as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    reviewUrl: (row.review_url as string | null) ?? null,
    directionsUrl: (row.directions_url as string | null) ?? null,
    reservationUrl: (row.reservation_url as string | null) ?? null,
    menuUrl: (row.menu_url as string | null) ?? null,
    instagramUrl: (row.instagram_url as string | null) ?? null,
    tiktokUrl: (row.tiktok_url as string | null) ?? null,
    facebookUrl: (row.facebook_url as string | null) ?? null,
    contactEmail: (row.contact_email as string | null) ?? null,
    enabled: row.enabled !== false,
  };
}

export function hubFromRow(row: Row): LinkHub {
  const hubType = String(row.hub_type ?? 'custom') as LinkHub['hubType'];
  const theme = String(row.theme ?? 'casa-aurelia-default') as LinkHub['theme'];
  return {
    id: String(row.id),
    locationId: (row.location_id as string | null) ?? null,
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    internalDescription: String(row.internal_description ?? ''),
    hubType,
    theme,
    status: String(row.status ?? 'draft') as LinkHub['status'],
    title: String(row.title ?? row.name ?? ''),
    subtitle: (row.subtitle as string | null) ?? null,
    logoAssetId: (row.logo_asset_id as string | null) ?? null,
    backgroundAssetId: (row.background_asset_id as string | null) ?? null,
    heroAssetId: (row.hero_asset_id as string | null) ?? null,
    customTheme: (row.custom_theme as Record<string, string> | null) ?? {},
    startAt: (row.start_at as string | null) ?? null,
    endAt: (row.end_at as string | null) ?? null,
    modeStrategy: row.mode_strategy === 'manual' ? 'manual' : 'auto',
    manualModeId: (row.manual_mode_id as string | null) ?? null,
    searchVisibility: row.search_visibility === 'searchable' ? 'searchable' : 'noindex',
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? row.created_at ?? ''),
  };
}

export function modeFromRow(row: Row): LinkHubMode {
  return {
    id: String(row.id),
    hubId: String(row.hub_id),
    name: String(row.name ?? ''),
    titleOverride: (row.title_override as string | null) ?? null,
    subtitleOverride: (row.subtitle_override as string | null) ?? null,
    enabled: row.enabled !== false,
    priority: Number(row.priority ?? 0),
    daysOfWeek: Array.isArray(row.days_of_week) ? row.days_of_week.map(Number) : [],
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
    startsOn: row.starts_on ? String(row.starts_on).slice(0, 10) : null,
    endsOn: row.ends_on ? String(row.ends_on).slice(0, 10) : null,
    activeEventOnly: Boolean(row.active_event_only),
  };
}

export function blockFromRow(row: Row): LinkHubBlock {
  return {
    id: String(row.id),
    hubId: String(row.hub_id),
    modeId: (row.mode_id as string | null) ?? null,
    blockType: String(row.block_type) as LinkHubBlock['blockType'],
    label: String(row.label ?? ''),
    config: (row.config as LinkHubBlock['config'] | null) ?? {},
    sort: Number(row.sort ?? 0),
    visible: row.visible !== false,
    startAt: (row.start_at as string | null) ?? null,
    endAt: (row.end_at as string | null) ?? null,
  };
}

function mediaFromRow(row: Row): HubMediaAsset | null {
  if (!row.path || row.archived_at || (row.kind && row.kind !== 'image' && row.kind !== 'video')) return null;
  return {
    id: String(row.asset_id),
    title: String(row.title ?? row.asset_id),
    path: String(row.path),
    alt: row.decorative ? '' : String(row.alt ?? ''),
    width: Number(row.width ?? 1200),
    height: Number(row.height ?? 800),
    kind: row.kind === 'video' ? 'video' : 'image',
    focal: String(row.focal ?? '50% 50%'),
  };
}

export function resolveHubMode(hub: LinkHub, modes: LinkHubMode[], now: Date, activeEvent: boolean): LinkHubMode | null {
  return resolveScheduledMode(hub, modes, now, activeEvent, site.timeZone);
}

function visibleBlock(block: LinkHubBlock, now: Date): boolean {
  if (!block.visible) return false;
  const stamp = now.getTime();
  return (!block.startAt || Date.parse(block.startAt) <= stamp) && (!block.endAt || Date.parse(block.endAt) > stamp);
}

async function hubEvents(now: Date): Promise<HubEventCard[]> {
  const input = await getPublicEvents();
  const resolved = getUpcomingEvents(input, now, 12).filter((event) => event.status !== 'cancelled' && event.status !== 'postponed');
  const artwork = await resolveManyEventArtwork(resolved);
  return resolved.map((event) => {
    const found = artwork.get(event.id)?.keyArt ?? artwork.get(event.id)?.flyer ?? null;
    const media = found?.path ? {
      id: `event-art:${event.id}`,
      title: event.title,
      path: found.path,
      alt: found.alt ?? '',
      width: found.width,
      height: found.height,
      kind: 'image' as const,
      focal: found.focal,
    } : null;
    return {
      id: event.id,
      title: event.title,
      date: formatEventDate(event.startsAt),
      time: formatTimeRange(event.startsAt, event.endsAt),
      href: event.seriesSlug ? `/events/${event.seriesSlug}` : `/events/${event.slug}`,
      ticketUrl: event.ticketUrl,
      artwork: media,
      category: event.presentation.category,
      featured: event.presentation.featured,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    };
  });
}

async function assemble(db: Db, hub: LinkHub, now: Date, preview: boolean): Promise<HubPageData> {
  const [modeRows, blockRows, locationRow, mediaRows, events] = await Promise.all([
    db.list<Row>('link_hub_modes', { where: { hub_id: hub.id }, orderBy: 'priority', desc: true }),
    db.list<Row>('link_hub_blocks', { where: { hub_id: hub.id }, orderBy: 'sort' }),
    hub.locationId ? db.get<Row>('link_hub_locations', hub.locationId) : Promise.resolve(null),
    db.list<Row>('media_assets', { orderBy: 'title' }),
    hubEvents(now),
  ]);
  const modes = modeRows.map(modeFromRow);
  const activeEvent = events.some((event) => Date.parse(event.startsAt) <= now.getTime() && Date.parse(event.endsAt) > now.getTime());
  const mode = resolveHubMode(hub, modes, now, activeEvent);
  const allBlocks = blockRows.map(blockFromRow);
  const modeBlocks = mode ? allBlocks.filter((block) => block.modeId === mode.id) : [];
  const selected = mode && modeBlocks.length > 0 ? modeBlocks : allBlocks.filter((block) => !block.modeId);
  const media = Object.fromEntries(mediaRows.map(mediaFromRow).filter((entry): entry is HubMediaAsset => entry !== null).map((entry) => [entry.id, entry]));
  return {
    hub,
    location: locationRow ? locationFromRow(locationRow) : null,
    mode,
    blocks: selected.filter((block) => preview || visibleBlock(block, now)).sort((a, b) => a.sort - b.sort),
    media,
    events,
    preview,
  };
}

export async function getPublicHub(slug: string, now = new Date()): Promise<HubPageData | null> {
  const db = getReadDb();
  if (!db) return null;
  try {
    const row = (await db.list<Row>('link_hubs')).find((entry) => String(entry.slug).toLowerCase() === slug.toLowerCase());
    if (!row) return null;
    const hub = hubFromRow(row);
    if (hub.status !== 'published') return null;
    const stamp = now.getTime();
    if ((hub.startAt && Date.parse(hub.startAt) > stamp) || (hub.endAt && Date.parse(hub.endAt) <= stamp)) return null;
    return await assemble(db, hub, now, false);
  } catch (error) {
    console.error('[link-hubs] public hub unavailable:', error);
    return null;
  }
}

export async function getDefaultPublicHub(now = new Date()): Promise<HubPageData | null> {
  const db = getReadDb();
  if (!db) return null;
  try {
    const rows = await db.list<Row>('link_hubs', { orderBy: 'updated_at', desc: true });
    const eligible = rows.map(hubFromRow).filter((hub) => {
      const stamp = now.getTime();
      return hub.status === 'published' && (!hub.startAt || Date.parse(hub.startAt) <= stamp) && (!hub.endAt || Date.parse(hub.endAt) > stamp);
    });
    const hub = eligible.find((entry) => entry.hubType === 'instagram-bio') ?? eligible[0];
    return hub ? assemble(db, hub, now, false) : null;
  } catch (error) {
    console.error('[link-hubs] default hub unavailable:', error);
    return null;
  }
}

/** Permanent QR payload lookup. It intentionally works for drafts: printing a
 * QR before launch is safe because the destination itself still returns 404
 * until staff publish the hub. No draft content is returned here. */
export async function getHubQrTarget(slug: string): Promise<string | null> {
  const db = getReadDb();
  if (!db) return null;
  try {
    const row = (await db.list<Row>('link_hubs')).find((entry) => String(entry.slug).toLowerCase() === slug.toLowerCase());
    return row ? String(row.slug) : null;
  } catch {
    return null;
  }
}

export async function listSearchableHubSlugs(): Promise<string[]> {
  const db = getReadDb();
  if (!db) return [];
  try {
    return (await db.list<Row>('link_hubs'))
      .map(hubFromRow)
      .filter((hub) => hub.status === 'published' && hub.searchVisibility === 'searchable')
      .map((hub) => hub.slug);
  } catch {
    return [];
  }
}

export async function getEditableHub(db: Db, id: string, now = new Date()): Promise<HubEditorData | null> {
  const row = await db.get<Row>('link_hubs', id);
  if (!row) return null;
  const hub = hubFromRow(row);
  const [page, locations, modes, blocks, mediaRows] = await Promise.all([
    assemble(db, hub, now, true),
    db.list<Row>('link_hub_locations', { orderBy: 'name' }),
    db.list<Row>('link_hub_modes', { where: { hub_id: id }, orderBy: 'priority', desc: true }),
    db.list<Row>('link_hub_blocks', { where: { hub_id: id }, orderBy: 'sort' }),
    db.list<Row>('media_assets', { orderBy: 'title' }),
  ]);
  return {
    hub,
    location: page.location,
    locations: locations.map(locationFromRow),
    modes: modes.map(modeFromRow),
    blocks: blocks.map(blockFromRow),
    media: mediaRows.map(mediaFromRow).filter((entry): entry is HubMediaAsset => entry !== null),
    events: page.events,
  };
}

export async function getEditableHubPreview(db: Db, id: string, now = new Date()): Promise<HubPageData | null> {
  const row = await db.get<Row>('link_hubs', id);
  return row ? assemble(db, hubFromRow(row), now, true) : null;
}

export async function listEditableHubs(db: Db): Promise<LinkHub[]> {
  return (await db.list<Row>('link_hubs', { orderBy: 'updated_at', desc: true })).map(hubFromRow);
}

export async function listHubLocations(db: Db): Promise<LinkHubLocation[]> {
  return (await db.list<Row>('link_hub_locations', { orderBy: 'name' })).map(locationFromRow);
}
