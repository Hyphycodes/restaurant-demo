import { assets, type AssetRecord } from '@/content/assets';
import { cateringItems, cateringPackages } from '@/content/catering';
import { eventOverrides, eventSeries, oneTimeEvents } from '@/content/events';
import { occurrenceFromSeed } from '@/lib/events';
import { allMenus } from '@/content/menu';
import { homeSections, pageCopy, seo } from '@/content/pages';
import { announcements, site } from '@/content/site';
import type { Row } from '@/lib/db/types';
import { stableUuid } from '@/lib/stable-uuid';
import { THEMES } from '@/themes/registry';
import { REFERENCE_LOCATIONS, REFERENCE_POSITIONS, REFERENCE_REQUIREMENT_TYPES } from '@/content/staff-reference';
import { REFERENCE_JOB_OPENINGS } from '@/content/careers';



export type Tables = Record<string, Row[]>;

export interface MigrationReport {
  counts: Record<string, number>;
  transformed: string[];
  skipped: string[];
  invalid: string[];
}

/** Menu items whose price the restaurant genuinely does not publish anywhere. */
function priceMode(item: { priceCents: number | null; priceNote: string | null }): string {
  if (item.priceCents != null) return 'fixed';
  return /market/i.test(item.priceNote ?? '') ? 'market' : 'ask-server';
}

export function buildRecords(): { tables: Tables; report: MigrationReport } {
  const tables: Tables = {};
  const transformed: string[] = [];
  const skipped: string[] = [];
  const invalid: string[] = [];

  const put = (table: string, rows: Row[]) => {
    tables[table] = rows;
  };

  /* ------------------------------------------------------------- settings */

  // The payload is EMPTY on purpose. It is a sparse override of the typed
  // defaults in src/content/site.ts, so an untouched install renders exactly what
  // the static modules say and nothing is duplicated into the database.
  put('site_settings', [{ id: 'default', payload: {} }]);

  // Link Hubs ship with a reusable location record but no public hubs. Staff
  // create the two recommended hubs from templates in Admin → Link Hubs, so a
  // migration never publishes a demo page by surprise.
  put('link_hub_locations', [{
    id: 'chicago',
    name: 'Cosa Nostra — Chicago',
    address: 'West Loop, Chicago, IL ',
    phone: site.phone.value,
    review_url: null,
    directions_url: site.directionsUrl,
    reservation_url: site.reservationUrl,
    menu_url: '/menu',
    instagram_url: site.socials.find((entry) => entry.platform === 'instagram')?.url ?? null,
    tiktok_url: site.socials.find((entry) => entry.platform === 'tiktok')?.url ?? null,
    facebook_url: site.socials.find((entry) => entry.platform === 'facebook')?.url ?? null,
    contact_email: site.email,
    enabled: true,
  }]);
  put('link_hubs', []);
  put('link_hub_modes', []);
  put('link_hub_blocks', []);
  put('link_hub_analytics', []);
  put('link_hub_leads', []);

  // Seasonal themes ship OFF. The row exists so the admin's theme screen has
  // something to edit on a fresh install; the config is empty because the
  // theme's own defaults apply until the admin changes something.
  put(
    'site_themes',
    Object.values(THEMES).map((theme) => ({
      slug: theme.slug,
      name: theme.name,
      enabled: false,
      schedule_enabled: false,
      start_at: null,
      end_at: null,
      config: {},
    })),
  );

  put(
    'announcements',
    announcements.map((a) => ({
      id: stableUuid('announcement', a.id),
      message: a.message,
      href: a.href,
      link_label: a.linkLabel,
      starts_at: a.startsAt,
      ends_at: a.endsAt,
      enabled: a.enabled,
      tone: a.tone,
    })),
  );

  put(
    'special_hours',
    site.temporaryClosures.map((closure) => ({
      id: closure.id,
      on_date: closure.date,
      closed: closure.allDay,
      ranges: [],
      note: closure.reason,
    })),
  );

  /* ----------------------------------------------------------------- menu */

  const menus: Row[] = [];
  const categories: Row[] = [];
  const items: Row[] = [];
  const modifiers: Row[] = [];

  allMenus.forEach((menu, menuIndex) => {
    menus.push({
      slug: menu.slug,
      title: menu.title,
      note: menu.note,
      empty_state: menu.emptyState,
      sort: menuIndex,
      draft: null,
      archived_at: null,
    });

    menu.categories.forEach((category, categoryIndex) => {
      categories.push({
        id: category.id,
        menu_slug: menu.slug,
        name: category.name,
        note: category.note,
        sort: categoryIndex,
        draft: null,
        archived_at: null,
      });

      category.items.forEach((item, itemIndex) => {
        if (item.priceCents == null && !item.priceNote) {
          invalid.push(`menu_items:${item.id} — no price and no note`);
          return;
        }

        const mode = priceMode(item);
        if (mode !== 'fixed') {
          transformed.push(`menu_items:${item.id} — price_mode "${mode}" from priceNote`);
        }

        items.push({
          id: item.id,
          category_id: category.id,
          name: item.name,
          description: item.description,
          price_mode: mode,
          price_cents: mode === 'fixed' ? item.priceCents : null,
          price_note: mode === 'fixed' ? null : item.priceNote,
          modifier_group_label: item.modifierGroupLabel,
          dietary: item.dietary,
          availability: item.available ? 'available' : 'unavailable',
          availability_note: null,
          available: item.available,
          featured: item.featured,
          media_asset_id: null,
          sort: itemIndex,
          draft: null,
          archived_at: null,
        });

        item.modifiers.forEach((modifier, modifierIndex) => {
          modifiers.push({
            // Deterministic, so re-running the migration updates the same row
            // rather than appending a second copy of every add-on.
            id: stableUuid('menu-modifier', `${item.id}:${modifierIndex}`),
            item_id: item.id,
            label: modifier.label,
            price_cents: modifier.priceCents,
            sort: modifierIndex,
          });
        });
      });
    });
  });

  put('menus', menus);
  put('menu_categories', categories);
  put('menu_items', items);
  put('menu_modifiers', modifiers);

  /* --------------------------------------------------------------- events */

  put(
    'event_series',
    eventSeries.map((series, index) => ({
      slug: series.slug,
      title: series.title,
      summary: series.summary,
      description: series.description,
      cadence:
        series.cadence.kind === 'weekly' ? `weekly:${series.cadence.weekday}` : 'one-time',
      start_minutes: series.startMinutes,
      end_minutes: series.endMinutes,
      age_min: series.ageMin,
      age_note: series.ageNote,
      music_formats: series.musicFormats,
      venue_name: series.venueName,
      artwork_asset_id: series.artworkAssetId,
      flyer_asset_id: series.flyerAssetId,
      flyer_printed_date: series.flyerPrintedDate,
      ticket_url: series.ticketUrl,
      ticket_policy: series.ticketPolicy,
      price_cents: series.priceCents,
      status: series.status,
      paused: false,
      series_ends_on: series.seriesEndsOn,
      sort: index,
      draft: null,
      archived_at: null,
    })),
  );

  put(
    'event_occurrences',
    eventOverrides.map((override) => ({
      id: `${override.seriesSlug}:${override.date}`,
      series_slug: override.seriesSlug,
      starts_at: override.date,
      ends_at: override.date,
      status: override.status ?? 'scheduled',
      ticket_url: override.ticketUrl ?? null,
      price_cents: override.priceCents ?? null,
      published: true,
      draft: null,
      archived_at: null,
    })),
  );

  // One-off events sit in the same table with no series behind them. Their
  // instants are computed for the venue's own date, so the seed is correct on
  // either side of a daylight-saving change.
  tables.event_occurrences = [
    ...(tables.event_occurrences ?? []),
    ...oneTimeEvents.map((seed) => {
      const record = occurrenceFromSeed(seed);
      return {
        id: record.id,
        series_slug: null,
        slug: record.slug,
        starts_at: record.startsAt,
        ends_at: record.endsAt,
        title: record.title,
        summary: record.summary,
        description: record.description,
        status: record.status ?? 'scheduled',
        ticket_url: record.ticketUrl,
        price_cents: null,
        price_text: record.presentation?.priceText ?? null,
        age_min: record.ageMin,
        age_note: record.ageNote,
        venue_name: record.venueName,
        // The official flyer slot starts EMPTY and is filled once by the
        // Tickeri import. Nothing else may write it.
        flyer_asset_id: null,
        key_art_asset_id: null,
        key_art_mobile_asset_id: null,
        foreground_asset_id: null,
        category: record.presentation?.category ?? null,
        visual_preset: record.presentation?.visualPreset ?? 'brass',
        featured: record.presentation?.featured ?? false,
        priority: record.presentation?.priority ?? 0,
        treatment: record.presentation?.treatment ?? 'standard',
        takeover_start_at: null,
        takeover_end_at: null,
        source: 'tickeri',
        source_event_id: record.provenance?.sourceEventId ?? null,
        source_url: record.provenance?.sourceUrl ?? null,
        synced_at: null,
        published: true,
        draft: null,
        archived_at: null,
      };
    }),
  ];

  /* ------------------------------------------------------------- catering */

  put(
    'catering_packages',
    cateringPackages.map((pkg, index) => ({
      id: pkg.id,
      name: pkg.name,
      serves_min: pkg.servesMin,
      serves_max: pkg.servesMax,
      price_cents: pkg.priceCents,
      includes: pkg.includes,
      sort: index,
      draft: null,
      archived_at: null,
    })),
  );

  put(
    'catering_items',
    cateringItems.map((item, index) => ({
      id: item.id,
      name: item.name,
      price_cents: item.priceCents,
      note: item.note,
      sort: index,
      draft: null,
      archived_at: null,
    })),
  );

  /* ---------------------------------------------------------------- pages */

  const sections: Row[] = homeSections.map((section, index) => ({
    id: `home:${section.key}`,
    page: 'home',
    key: section.key,
    eyebrow: section.eyebrow,
    heading: section.heading,
    body: section.body,
    visible: section.visible,
    variant: section.variant,
    media_asset_id: null,
    cta_label: null,
    cta_href: null,
    sort: index,
    draft: null,
    archived_at: null,
  }));

  // The route openers are the same kind of record — an eyebrow, a heading and a
  // sentence, in a slot the design already has. Naming them here is what lets the
  // Website section edit them without inventing a page builder.
  const openers: [string, { eyebrow?: string; heading: string; body?: string }][] = [
    ['menu', pageCopy.menu],
    ['events', pageCopy.events],
    ['catering', pageCopy.catering],
    ['private-events', pageCopy.privateEvents],
    ['visit', pageCopy.visit],
    ['contact', pageCopy.contact],
    ['careers', pageCopy.careers],
    ['talent', pageCopy.talent],
  ];

  openers.forEach(([page, copy], index) => {
    sections.push({
      id: `${page}:opener`,
      page,
      key: 'opener',
      eyebrow: copy.eyebrow ?? null,
      heading: copy.heading,
      body: copy.body ?? null,
      visible: true,
      variant: 'plain',
      media_asset_id: null,
      cta_label: null,
      cta_href: null,
      sort: index,
      draft: null,
      archived_at: null,
    });
  });

  sections.push({
    id: 'home:hero',
    page: 'home',
    key: 'hero',
    eyebrow: 'Chicago, Illinois',
    // Joined with a NEWLINE, not a space: the hero splits its heading on
    // newlines to set each line of the marquee, so a space here would collapse
    // a deliberate two-line statement into one and the seeded row would render
    // differently from the built-in default it was made from.
    heading: pageCopy.home.heroHeadlineLines.join('\n'),
    body: pageCopy.home.heroBody,
    visible: true,
    variant: 'band',
    media_asset_id: 'heroImage',
    cta_label: null,
    cta_href: null,
    sort: -1,
    draft: null,
    archived_at: null,
  });

  put('page_sections', sections);

  put(
    'page_seo',
    Object.entries(seo).map(([page, entry]) => ({
      page,
      title: entry.title,
      description: entry.description,
      og_asset_id: entry.ogAssetId,
    })),
  );

  // The safe editable option lists. Locked-down form mechanics — validation,
  // spam protection, delivery — are deliberately NOT here.
  // Positions used to be a list here. They are rows in `job_openings` now
  // (migration 0026), because a position people can apply for has a
  // description, a location and an on/off switch — none of which a list of
  // strings can carry. See src/content/careers.ts.
  put('page_lists', [
    {
      id: 'careers:perks',
      page: 'careers',
      key: 'perks',
      label: 'Perks listed on the careers page',
      items: [...pageCopy.careers.perks],
      draft: null,
      archived_at: null,
    },
    {
      id: 'private-events:types',
      page: 'private-events',
      key: 'types',
      label: 'Celebration types in the enquiry form',
      items: [
        'Birthday',
        'Rehearsal dinner',
        'Graduation',
        'Company dinner',
        'Engagement celebration',
        'Other celebration',
      ],
      draft: null,
      archived_at: null,
    },
  ]);

  /* ---------------------------------------------------------------- media */

  put(
    'media_assets',
    Object.entries(assets as Record<string, AssetRecord>).map(([id, asset]) => {
      if (!asset.path && asset.status !== 'placeholder') {
        invalid.push(`media_assets:${id} — no file but status "${asset.status}"`);
      }
      if (!asset.path) skipped.push(`media_assets:${id} — reserved slot, no file yet`);

      return {
        asset_id: id,
        path: asset.path,
        // A null alt in the registry is an explicit "decorative" decision, and it
        // has to survive as one — not as missing alt text somebody later "fixes".
        alt: asset.alt,
        decorative: asset.alt === null,
        title: id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()),
        kind: asset.kind === 'vector' ? 'image' : asset.kind,
        width: asset.width,
        height: asset.height,
        ratio: asset.ratio,
        focal: asset.focal,
        poster: asset.poster ?? null,
        status: asset.status,
        tags: mediaTags(id, asset),
        size_bytes: null,
        mime: null,
        duration_seconds: null,
        draft: null,
        archived_at: null,
      };
    }),
  );

  const counts = Object.fromEntries(
    Object.entries(tables).map(([table, rows]) => [table, rows.length]),
  );

  /* -------------------------------------------------- staff reference data */

  // The location, the positions and the onboarding checklist: configuration,
  // not people. Demo employees live in src/server/staff/demo.ts and are only
  // ever seeded on purpose.
  put('locations', REFERENCE_LOCATIONS);
  put('positions', REFERENCE_POSITIONS);
  put('requirement_types', REFERENCE_REQUIREMENT_TYPES);
  // The standard restaurant roles, every one of them inactive. They are here
  // so the owner switches a role on rather than typing it in; nothing is
  // public until they do. See src/content/careers.ts.
  put('job_openings', REFERENCE_JOB_OPENINGS);

  return { tables, report: { counts, transformed, skipped, invalid } };
}

/** The small controlled tag list from the brief, assigned from real placement. */
function mediaTags(id: string, asset: AssetRecord): string[] {
  const tags = new Set<string>();
  const usage = asset.usage.join(' ').toLowerCase();
  const key = id.toLowerCase();

  if (asset.status === 'brand' || key.startsWith('brand')) tags.add('Brand');
  if (/menu\//.test(asset.path ?? '') || /dish|plate|pasta|consomme/.test(key)) tags.add('Food');
  if (/cocktail|martini|bar/.test(key)) tags.add('Drinks');
  if (/flyer|event/.test(key) || /event/.test(usage)) tags.add('Events');
  if (/room|dining|hero/.test(key)) tags.add('Room');
  if (/exterior/.test(key)) tags.add('Exterior');
  if (/team|bartender|careers/.test(key) || /careers/.test(usage)) tags.add('Team');

  return [...tags];
}
