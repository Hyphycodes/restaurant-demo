import 'server-only';

import type { Db, Row } from '@/lib/db/types';
import { getUpcomingEvents, ineligibleReason, venueIsoDate } from '@/lib/events';
import { getEditableEvents } from './events';
import { stateOf, type EditorialRow } from './editorial';
import { getMediaLibrary } from './media';
import { getEditableMenus } from './menu';
import { listThemeRecords } from './theme';
import { THEMES } from '@/themes/registry';
import { formatVenueMoment, themeStatusAt } from '@/themes/schedule';

/**
 * What needs attention, computed from the real records.
 *
 * Every warning here has to satisfy one rule: it links to the exact field that
 * fixes it. A dashboard that says "3 problems" and makes you hunt for them is
 * worse than no dashboard, because it trains people to ignore it.
 */

/** A one-tap fix the tidy page can offer instead of a link. */
export type AttentionFix =
  | { kind: 'unpublish-occurrence'; id: string }
  | { kind: 'menu-available'; id: string }
  | { kind: 'publish-menu-row'; table: 'menu_items' | 'menu_categories' | 'menus'; id: string };

export interface Attention {
  id: string;
  severity: 'blocking' | 'warning' | 'info';
  message: string;
  /** Where to go to fix it. */
  href: string;
  actionLabel: string;
  /** Housekeeping the tidy page can do in one tap. */
  fix?: AttentionFix;
  /** What kind of thing it is, for the one-sentence summary on the home screen. */
  kind: 'past-event' | 'draft' | 'sold-out-dish' | 'unpriced-dish' | 'artwork' | 'alt-text' | 'theme' | 'hours' | 'tickets' | 'other';
}

export async function getAttention(db: Db, now: Date): Promise<Attention[]> {
  const items: Attention[] = [];

  const [menus, events, media, sections, lists, specials] = await Promise.all([
    getEditableMenus(db),
    getEditableEvents(db),
    getMediaLibrary(db),
    db.list<Row>('page_sections'),
    db.list<Row>('page_lists'),
    db.list<Row>('special_hours', { orderBy: 'on_date' }),
  ]);

  /* ------------------------------------------------------------- events -- */

  const upcoming = getUpcomingEvents(events, now);

  for (const series of events.series) {
    if (series.archivedAt) continue;

    const future = upcoming.filter((event) => event.seriesSlug === series.slug);
    if (future.length === 0 && !series.paused) {
      items.push({
        id: `series-empty-${series.slug}`,
        kind: 'other',
        severity: 'blocking',
        message: `${series.title} has no dates coming up. Guests see nothing for it.`,
        href: `/admin/events/${series.slug}`,
        actionLabel: 'Open the series',
      });
    }

    if (series.ticketPolicy === 'required' && !series.flyerAssetId) {
      items.push({
        id: `series-artwork-${series.slug}`,
        kind: 'artwork',
        severity: 'warning',
        message: `${series.title} has no flyer, so the events page shows a placeholder.`,
        href: `/admin/events/${series.slug}`,
        actionLabel: 'Add artwork',
      });
    }
  }

  // The failure the August 15 audit found: something already finished still being
  // presented as what is on. It cannot happen through the selector, so this
  // checks the stored overrides, which a person can edit by hand.
  for (const row of await db.list<Row>('event_occurrences')) {
    if (row.archived_at) continue;
    const date = String(row.starts_at).slice(0, 10);
    const isPast = date < venueIsoDate(now.toISOString());
    if (isPast && row.published !== false && row.status !== 'cancelled') {
      items.push({
        id: `stale-occurrence-${row.id}`,
        kind: 'past-event',
        severity: 'info',
        message: `${row.title ?? 'A night'} on ${date} has passed and is still on the calendar. Guests cannot see it.`,
        href: `/admin/events/one/${encodeURIComponent(String(row.id))}`,
        actionLabel: 'Take it off',
        fix: { kind: 'unpublish-occurrence', id: String(row.id) },
      });
    }
  }

  for (const event of upcoming.slice(0, 8)) {
    if (!event.ticketUrl && event.series?.ticketPolicy === 'required') {
      items.push({
        id: `no-tickets-${event.id}`,
        kind: 'tickets',
        severity: 'blocking',
        message: `${event.title} on ${venueIsoDate(event.startsAt)} has no ticket link.`,
        href: `/admin/events/${event.seriesSlug ?? ''}`,
        actionLabel: 'Add the link',
      });
    }
    const reason = ineligibleReason(event, now);
    if (reason === 'Draft — not on the website yet') {
      items.push({
        id: `draft-event-${event.id}`,
        kind: 'draft',
        severity: 'info',
        message: `${event.title} on ${venueIsoDate(event.startsAt)} is still a draft.`,
        href: '/admin/events',
        actionLabel: 'Publish it',
      });
    }
  }

  /* --------------------------------------------------------------- menu -- */

  const allItems = menus.flatMap((menu) =>
    menu.categories.flatMap((category) => category.items.map((item) => ({ menu, category, item }))),
  );

  const waiting = allItems.filter(({ item }) => item.state === 'changed');
  if (waiting.length > 0) {
    items.push({
      id: 'menu-drafts',
      kind: 'draft',
      severity: 'info',
      message: `${waiting.length} menu ${waiting.length === 1 ? 'change is' : 'changes are'} saved but not published yet.`,
      href: '/admin/menu',
      actionLabel: 'Review and publish',
    });
  }

  for (const { item } of allItems.filter(({ item }) => item.availability === 'unavailable')) {
    items.push({
      id: `menu-sold-out-${item.id}`,
      kind: 'sold-out-dish',
      severity: 'info',
      message: `${item.name} is marked sold out. Guests see it greyed out.`,
      href: `/admin/menu/${item.id}`,
      actionLabel: 'Put it back',
      fix: { kind: 'menu-available', id: item.id },
    });
  }

  const unpriced = allItems.filter(
    ({ item }) => item.priceMode === 'ask-server' && item.availability !== 'hidden',
  );
  if (unpriced.length > 0) {
    items.push({
      id: 'menu-unpriced',
      kind: 'unpriced-dish',
      severity: 'info',
      message: `${unpriced.length} ${unpriced.length === 1 ? 'item shows' : 'items show'} “Ask your server” instead of a price.`,
      href: '/admin/menu',
      actionLabel: 'Add prices',
    });
  }

  /* -------------------------------------------------------------- media -- */

  for (const asset of media) {
    if (asset.archivedAt || !asset.path) continue;
    if (!asset.decorative && !asset.alt?.trim()) {
      items.push({
        id: `alt-${asset.assetId}`,
        kind: 'alt-text',
        severity: 'warning',
        message: `“${asset.title}” has no description, so screen readers cannot describe it.`,
        href: `/admin/media/${asset.assetId}`,
        actionLabel: 'Describe it',
      });
    }
  }

  /* ------------------------------------------------------------ website -- */

  for (const row of [...sections, ...lists]) {
    if (stateOf(row as EditorialRow) !== 'changed') continue;
    const page = String(row.page ?? 'home');
    items.push({
      id: `page-draft-${row.id}`,
      kind: 'draft',
      severity: 'info',
      message: `Changes to the ${page === 'home' ? 'homepage' : page} are saved but not published.`,
      href: `/admin/website/${page}`,
      actionLabel: 'Review and publish',
    });
  }

  /* -------------------------------------------------------------- hours -- */

  const today = venueIsoDate(now.toISOString());
  const soon = venueIsoDate(new Date(now.getTime() + 7 * 86_400_000).toISOString());
  for (const row of specials) {
    const date = String(row.on_date);
    if (date >= today && date <= soon) {
      items.push({
        id: `special-${row.id}`,
        kind: 'hours',
        severity: 'info',
        message: `Special hours are set for ${date}: ${row.note}.`,
        href: '/admin/settings',
        actionLabel: 'Check it',
      });
    }
  }

  /* -------------------------------------------------------------- theme -- */

  // Guarded: the table arrives with migration 0004, and a dashboard must not
  // fail because one migration has not been applied yet.
  const themes = await listThemeRecords(db).catch(() => []);
  for (const record of themes) {
    const status = themeStatusAt(record, now);
    const name = THEMES[record.slug].name;
    if (status === 'ended') {
      items.push({
        id: `theme-ended-${record.slug}`,
        kind: 'theme',
        severity: 'info',
        message: `${name} is switched on but its dates have passed, so guests see Default Cosa Nostra. Set new dates or switch it off.`,
        href: '/admin/theme',
        actionLabel: 'Open the seasonal look',
      });
    } else if (status === 'scheduled') {
      items.push({
        id: `theme-scheduled-${record.slug}`,
        kind: 'theme',
        severity: 'info',
        message: `${name} switches itself on ${formatVenueMoment(record.startAt, 'America/Chicago')}.`,
        href: '/admin/theme',
        actionLabel: 'Preview it',
      });
    }
  }

  const order = { blocking: 0, warning: 1, info: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Housekeeping, as one sentence.
 *
 * Nothing here costs money right now, so nothing here gets a badge, a count in
 * a chip, or a colour. The two biggest kinds are named in words; the rest are
 * "a few other things". Reassuring where it can be: a past event that is still
 * listed is hidden from guests, so nothing is broken.
 */
export function housekeepingSentence(items: Attention[]): string | null {
  if (items.length === 0) return null;
  const count = (kind: Attention['kind']) => items.filter((entry) => entry.kind === kind).length;
  const words = (n: number) => ['zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][n] ?? String(n);
  const parts: string[] = [];
  const past = count('past-event');
  if (past > 0) parts.push(`${words(past)} past ${past === 1 ? 'event is' : 'events are'} still on the calendar, hidden from guests`);
  const soldOut = count('sold-out-dish');
  if (soldOut > 0) parts.push(`${soldOut === 1 ? 'one dish is' : `${soldOut} dishes are`} marked sold out`);
  const drafts = count('draft');
  if (drafts > 0) parts.push(`${drafts === 1 ? 'one draft is' : `${drafts} drafts are`} waiting`);
  const alt = count('alt-text');
  if (alt > 0) parts.push(`${alt === 1 ? 'one photo has' : `${alt} photos have`} no description`);
  const rest = items.length - past - soldOut - drafts - alt;
  const lead = parts.slice(0, 2);
  const remainder = parts.length - lead.length + (rest > 0 ? 1 : 0);
  let sentence = lead.join(', and ');
  if (!sentence) sentence = `${words(items.length)} small ${items.length === 1 ? 'thing' : 'things'} could use a look`;
  else if (remainder > 0) sentence += `, plus a few other things`;
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  return `${sentence}. Tidy up whenever.`;
}

/** The most recent edits across every kind of record, for "recently changed". */
export async function getRecentChanges(db: Db, limit = 8) {
  const rows = await db.list<Row>('content_versions', { orderBy: 'at', desc: true, limit });
  return rows.map((row) => ({
    id: String(row.id),
    table: String(row.table_name),
    rowId: String(row.row_id),
    label: String(row.label ?? ''),
    actorName: String(row.actor_name ?? 'Someone'),
    at: String(row.at),
  }));
}

export const TABLE_LABEL: Record<string, string> = {
  menu_items: 'Menu item',
  menu_categories: 'Menu section',
  menus: 'Menu',
  event_series: 'Event series',
  event_occurrences: 'Event night',
  page_sections: 'Website copy',
  page_lists: 'Form options',
  media_assets: 'Photo',
  catering_packages: 'Catering package',
  catering_items: 'Catering tray',
};
