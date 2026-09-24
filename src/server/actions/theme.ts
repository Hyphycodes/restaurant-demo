'use server';

import { z } from 'zod';
import { venueLocalIso } from '@/lib/events';
import { storeMediaFile } from '@/server/media-files';
import {
  getThemeRecord,
  listThemeRecords,
  recordToRow,
  THEME_TABLE,
} from '@/server/content/theme';
import { isIntensity, normalizeConfig } from '@/themes/config';
import { isSeasonalSlug, isThemeSlug, THEMES } from '@/themes/registry';
import {
  THEME_ASSET_SLOTS,
  THEME_OPTIONS,
  type SeasonalThemeSlug,
  type ThemeAssetSlot,
  type ThemeRecord,
} from '@/themes/types';
import { done, run, type ActionState } from './shared';

/**
 * The seasonal theme, from the admin's point of view.
 *
 * Three actions, all needing `content.publish`: the theme is the whole site's
 * look, so changing it is publishing, and a Contributor cannot do it. Every
 * save revalidates every public route, because every page carries the theme.
 *
 * Only one seasonal theme can be enabled at a time. Choosing one switches the
 * others off in the same save, so "which theme is on" is never ambiguous.
 */

const time = z.string().regex(/^\d{2}:\d{2}$/).or(z.literal(''));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(''));

const saveSchema = z.object({
  /** 'default' or a seasonal slug — which look the website wears. */
  active: z.string(),
  /** Which seasonal theme this form's options belong to. */
  slug: z.string(),
  intensity: z.string(),
  scheduleEnabled: z.coerce.boolean(),
  startDate: date,
  startTime: time,
  endDate: date,
  endTime: time,
});

export async function saveTheme(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = saveSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: 'Please check the form and try again.' };
    const value = parsed.data;

    if (!isThemeSlug(value.active)) return { ok: false, message: 'Choose a look from the list.' };
    if (!isSeasonalSlug(value.slug)) return { ok: false, message: 'That theme is not recognised.' };
    if (!isIntensity(value.intensity)) return { ok: false, message: 'Choose an intensity.' };

    const slug: SeasonalThemeSlug = value.slug;
    const existing = await getThemeRecord(db, slug);

    // Options come through as checkboxes: present means on, absent means off.
    const options = { ...existing.config.options };
    for (const option of THEME_OPTIONS) options[option] = formData.get(`option.${option}`) === 'true';

    const window = value.scheduleEnabled ? parseWindow(value) : { ok: true as const, startAt: null, endAt: null };
    if (!window.ok) return { ok: false, message: window.message };

    const enabled = value.active === slug;
    const record: ThemeRecord = {
      ...existing,
      enabled,
      scheduleEnabled: value.scheduleEnabled,
      startAt: window.startAt,
      endAt: window.endAt,
      config: normalizeConfig(
        { ...existing.config, options, intensity: value.intensity },
        THEMES[slug].defaults,
      ),
    };

    await db.upsert(THEME_TABLE, recordToRow(record));

    // One look at a time.
    for (const other of await listThemeRecords(db)) {
      if (other.slug !== slug && other.enabled) {
        await db.update(THEME_TABLE, other.slug, { enabled: false });
      }
    }

    const name = THEMES[slug].name;
    const message = !enabled
      ? 'The website is back to Default Casa Aurelia.'
      : value.scheduleEnabled
        ? `${name} is saved and will show itself between the dates you set.`
        : `${name} is live on the website now.`;
    return done(message, 'theme');
  });
}

function parseWindow(value: z.infer<typeof saveSchema>):
  | { ok: true; startAt: string | null; endAt: string | null }
  | { ok: false; message: string } {
  const toIso = (day: string, clock: string, fallback: string) => {
    if (!day) return null;
    const [y, m, d] = day.split('-').map(Number);
    const [hh, mm] = (clock || fallback).split(':').map(Number);
    return venueLocalIso(y!, m!, d!, (hh ?? 0) * 60 + (mm ?? 0));
  };
  const startAt = toIso(value.startDate, value.startTime, '00:00');
  const endAt = toIso(value.endDate, value.endTime, '23:59');
  if (!startAt && !endAt) {
    return { ok: false, message: 'Set at least a start or an end date, or untick the dates option.' };
  }
  if (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt)) {
    return { ok: false, message: 'The end has to come after the start.' };
  }
  return { ok: true, startAt, endAt };
}


export async function deactivateThemes(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    for (const record of await listThemeRecords(db)) {
      if (record.enabled) await db.update(THEME_TABLE, record.slug, { enabled: false });
    }
    return done('The website is back to Default Casa Aurelia.', 'theme');
  });
}

/* ------------------------------------------------------------- artwork -- */

const assetSchema = z.object({
  slug: z.string(),
  slot: z.string(),
});

function isSlot(value: string): value is ThemeAssetSlot {
  return (THEME_ASSET_SLOTS as readonly string[]).includes(value);
}

/**
 * Replace one piece of the theme's artwork.
 *
 * The file goes through the same upload path as every other photograph, so it
 * lands in the Photos library with a title and a tag, and the theme stores the
 * asset id — not a URL. Removing the override later leaves the file in the
 * library, where it can be reused or archived like anything else.
 */
export async function uploadThemeAsset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db, staff }) => {
    const parsed = assetSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success || !isSeasonalSlug(parsed.data.slug) || !isSlot(parsed.data.slot)) {
      return { ok: false, message: 'Could not tell which artwork to replace.' };
    }
    const { slug, slot } = parsed.data;
    const spec = THEMES[slug].assets[slot];

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: 'Choose an image to upload first.' };
    }
    const isVideo = file.type.startsWith('video/');
    if (isVideo && spec.accepts === 'image') {
      return { ok: false, message: `${spec.label} needs an image, not a video.` };
    }
    if (!isVideo && spec.accepts === 'video') {
      return { ok: false, message: `${spec.label} needs a video.` };
    }

    const stored = await storeMediaFile({
      db,
      staff,
      file,
      title: `${THEMES[slug].shortName} — ${spec.label}`,
      alt: 'Decorative media',
      tags: ['Theme'],
    });
    if (!stored.ok) return stored;
    // Theme artwork is decoration by definition; it must never be read aloud.
    await db.update('media_assets', stored.assetId, { alt: null, decorative: true });

    const record = await getThemeRecord(db, slug);
    record.config = { ...record.config, assets: { ...record.config.assets, [slot]: stored.assetId } };
    await db.upsert(THEME_TABLE, recordToRow(record));

    return done(
      record.enabled
        ? `${spec.label} replaced. It is on the website now.`
        : `${spec.label} replaced. It will show when the theme is on.`,
      'theme',
    );
  });
}

export async function clearThemeAsset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run('content.publish', async ({ db }) => {
    const parsed = assetSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success || !isSeasonalSlug(parsed.data.slug) || !isSlot(parsed.data.slot)) {
      return { ok: false, message: 'Could not tell which artwork to reset.' };
    }
    const { slug, slot } = parsed.data;
    const record = await getThemeRecord(db, slug);
    const assets = { ...record.config.assets };
    delete assets[slot];
    record.config = { ...record.config, assets };
    await db.upsert(THEME_TABLE, recordToRow(record));
    return done(`${THEMES[slug].assets[slot].label} is back to the built-in artwork.`, 'theme');
  });
}
