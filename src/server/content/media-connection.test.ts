import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __setLocalDbForTests } from '@/lib/db';
import { LocalDb } from '@/lib/db/local';
import type { Row } from '@/lib/db/types';
import { getUpcomingEvents, nextEvent, venueIsoDate } from '@/lib/events';
import { buildRecords } from '@/server/migration/records';
import { getEditableEvents } from './events';
import { routesOfRegistryUsage, usageOf } from './media';

/**
 * The connection between what the admin edits and what a guest sees.
 *
 * Every image on the site used to be read straight from the typed registry, so
 * the Photos screen was a catalogue of things it could not change. These pin the
 * fix: the public resolver reads the record, an event's artwork inherits from its
 * series until one night is given its own, and removing that override puts the
 * night back.
 */

let dir: string;
let db: LocalDb;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cosa-nostra-media-'));
  db = new LocalDb(dir, () => buildRecords().tables);
  __setLocalDbForTests(db);
});

afterEach(async () => {
  __setLocalDbForTests(null);
  await rm(dir, { recursive: true, force: true });
});

/** Fresh module instance per call: `getMediaMap` is React-cached per render. */
async function resolveMedia() {
  // The uncached loader: `getMediaMap` memoises per render, which is right in a
  // page and wrong in a test that changes the data between assertions.
  const { loadMediaMap } = await import('@/content/media');
  return loadMediaMap();
}

describe('the public site reads photographs from the record', () => {
  it('starts out matching the built-in registry exactly', async () => {
    const map = await resolveMedia();
    expect(map.signaturePasta?.path).toBe('/media/signaturePasta.webp');
    expect(map.flyerFridays?.path).toBe('/media/flyerFridays.webp');
  });

  it('serves the new file after a slot is pointed somewhere else', async () => {
    await db.update('media_assets', 'signaturePasta', {
      path: '/media/menu/consomme-dip.jpg',
      alt: 'A different photograph',
    });

    const map = await resolveMedia();
    expect(map.signaturePasta?.path).toBe('/media/menu/consomme-dip.jpg');
    expect(map.signaturePasta?.alt).toBe('A different photograph');
  });

  it('treats an explicit decorative choice as decorative, not as missing alt text', async () => {
    await db.update('media_assets', 'signaturePasta', { decorative: true, alt: 'ignored' });
    const map = await resolveMedia();
    // null is what makes <Asset> render alt="" and aria-hidden.
    expect(map.signaturePasta?.alt).toBeNull();
  });

  it('renders the placeholder rather than a broken image when a photo is archived', async () => {
    await db.update('media_assets', 'signaturePasta', { archived_at: new Date().toISOString() });
    const map = await resolveMedia();
    expect(map.signaturePasta?.path).toBeNull();
  });

  it('falls back to the registry when there is no database at all', async () => {
    __setLocalDbForTests(null);
    const map = await resolveMedia();
    // The guarantee that keeps the site up during an outage.
    expect(map.signaturePasta?.path).toBe('/media/signaturePasta.webp');
  });
});

describe('event artwork', () => {
  const now = new Date('2026-08-15T18:00:00Z');

  it('inherits the series flyer on every night by default', async () => {
    const events = await getEditableEvents(db);
    const nights = getUpcomingEvents(events, now, 6).filter(
      (event) => event.seriesSlug === 'after-hours-saturday',
    );

    expect(nights.length).toBeGreaterThan(1);
    for (const night of nights) {
      expect(night.flyerAssetId).toBe('flyerSaturday');
      // Inherited, so the admin labels it "Series artwork".
      expect(night.overriddenFields).not.toContain('flyerAssetId');
    }
  });

  it('follows the series when the series artwork changes', async () => {
    await db.update('event_series', 'after-hours-saturday', {
      flyer_asset_id: 'flyerFridays',
      flyer_printed_date: null,
    });

    const events = await getEditableEvents(db);
    const nights = getUpcomingEvents(events, now, 4).filter(
      (event) => event.seriesSlug === 'after-hours-saturday',
    );
    expect(nights.every((night) => night.flyerAssetId === 'flyerFridays')).toBe(true);
  });

  it('changes one night only, and marks it as that night’s own', async () => {
    const events = await getEditableEvents(db);
    const target = nextEvent(events, now, 'after-hours-saturday')!;
    // Venue-local, not UTC: 10pm Saturday in Chicago is Sunday in UTC.
    const date = venueIsoDate(target.startsAt);

    await db.insert('event_occurrences', {
      id: `after-hours-saturday:${date}`,
      series_slug: 'after-hours-saturday',
      starts_at: date,
      flyer_asset_id: 'flyerFridays',
      published: true,
    });

    const after = getUpcomingEvents(await getEditableEvents(db), now, 6).filter(
      (event) => event.seriesSlug === 'after-hours-saturday',
    );

    const changed = after.filter((event) => event.flyerAssetId === 'flyerFridays');
    expect(changed).toHaveLength(1);
    expect(changed[0]!.overriddenFields).toContain('flyerAssetId');

    // And every other night is untouched — the failure this guards against is
    // changing twenty nights while meaning to change one.
    for (const night of after.filter((event) => event !== changed[0])) {
      expect(night.flyerAssetId).toBe('flyerSaturday');
      expect(night.overriddenFields).not.toContain('flyerAssetId');
    }
  });

  it('goes back to the series flyer when the override is removed', async () => {
    const events = await getEditableEvents(db);
    const target = nextEvent(events, now, 'after-hours-saturday')!;
    // Venue-local, not UTC: 10pm Saturday in Chicago is Sunday in UTC.
    const date = venueIsoDate(target.startsAt);
    const id = `after-hours-saturday:${date}`;

    await db.insert('event_occurrences', {
      id,
      series_slug: 'after-hours-saturday',
      starts_at: date,
      flyer_asset_id: 'flyerFridays',
      published: true,
    });
    await db.remove('event_occurrences', id);

    const back = nextEvent(await getEditableEvents(db), now, 'after-hours-saturday')!;
    expect(back.flyerAssetId).toBe('flyerSaturday');
    expect(back.overriddenFields).not.toContain('flyerAssetId');
  });

  it('reports the event as a place the photograph is used', async () => {
    const usage = await usageOf(db, 'flyerSaturday');
    expect(usage.map((entry) => entry.route)).toContain('/events/after-hours-saturday');
  });

  it('counts a one-night override as a use of that photograph too', async () => {
    await db.insert('event_occurrences', {
      id: 'after-hours-saturday:2026-08-22',
      series_slug: 'after-hours-saturday',
      starts_at: '2026-08-22',
      flyer_asset_id: 'flyerFridays',
      published: true,
    });

    const usage = await usageOf(db, 'flyerFridays');
    // Two: the Fridays series itself, and the Saturday borrowing it.
    expect(usage.length).toBeGreaterThanOrEqual(2);
  });
});

describe('which pages a design-placed photograph touches', () => {
  it('maps an explicit route straight through', () => {
    expect(routesOfRegistryUsage(['/menu#cocktails'])).toEqual(['/menu']);
  });

  it('treats the header and the footer as every page', () => {
    // A logo swap is site-wide; refreshing one route would leave the rest stale.
    expect(routesOfRegistryUsage(['Header', 'Footer']).length).toBeGreaterThan(5);
  });

  it('reads prose placements', () => {
    const routes = routesOfRegistryUsage(['Homepage gallery', 'Careers imagery']);
    expect(routes).toContain('/');
    expect(routes).toContain('/careers');
  });

  it('returns nothing it cannot place, rather than guessing', () => {
    expect(routesOfRegistryUsage(['Something nobody wrote down'])).toEqual([]);
  });
});

describe('every photograph the site shows has a record behind it', () => {
  it('registers every registry asset, so nothing is invisible to the admin', async () => {
    const { assets } = await import('@/content/assets');
    const rows = await db.list<Row>('media_assets');
    const stored = new Set(rows.map((row) => String(row.asset_id)));

    for (const id of Object.keys(assets)) {
      expect(stored.has(id), `${id} is on the website but not in Photos`).toBe(true);
    }
    expect(rows).toHaveLength(Object.keys(assets).length);
  });
});
