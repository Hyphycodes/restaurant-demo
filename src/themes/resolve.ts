import 'server-only';

import { cache } from 'react';
import { getMediaMap } from '@/content/media';
import { getReadDb } from '@/lib/db';
import { listThemeRecords } from '@/server/content/theme';
import { getAppearance } from '@/server/appearance';
import { normalizeConfig, presetFor } from './config';
import { getThemeDefinition, isSeasonalSlug, PRESETS } from './registry';
import { isThemeActiveAt } from './schedule';
import {
  THEME_ASSET_SLOTS,
  type ResolvedTheme,
  type ResolvedThemeAsset,
  type SeasonalThemeSlug,
  type ThemeConfig,
  type ThemeRecord,
} from './types';



const QUERY_TIMEOUT_MS = 2500;

export const DEFAULT_RESOLVED: ResolvedTheme = {
  slug: 'default',
  definition: null,
  config: { options: { texture: false, glow: false, petals: false, edges: false, motion: false }, intensity: 'standard', assets: {} },
  preset: PRESETS.standard,
  assets: Object.fromEntries(
    THEME_ASSET_SLOTS.map((slot) => [slot, { path: null, kind: 'image', overridden: false }]),
  ) as Record<(typeof THEME_ASSET_SLOTS)[number], ResolvedThemeAsset>,
  source: 'default',
};

/** Request-scoped override. Only the preview route writes to it. */
const overrideStore = cache((): { theme: ResolvedTheme | null } => ({ theme: null }));

export function setThemeOverride(theme: ResolvedTheme): void {
  overrideStore().theme = theme;
}

/** Every stored theme, for the admin and for resolution. Never throws. */
export const getThemeRecords = cache(async (): Promise<ThemeRecord[]> => {
  const db = getReadDb();
  if (!db) return [];
  try {
    const records = await Promise.race([
      listThemeRecords(db),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), QUERY_TIMEOUT_MS)),
    ]);
    return records ?? [];
  } catch (error) {
    console.error('[theme] could not read site_themes, using Default Cosa Nostra:', error);
    return [];
  }
});

export const getActiveTheme = cache(async (): Promise<ResolvedTheme> => {
  const override = overrideStore().theme;
  if (override) return override;

  const forced = process.env.COSA_NOSTRA_THEME_FORCE?.trim();
  if (forced && process.env.NODE_ENV !== 'production' && isSeasonalSlug(forced)) {
    const record = (await getThemeRecords()).find((entry) => entry.slug === forced);
    return resolveTheme(forced, record?.config, 'forced');
  }

  // The appearance row says which season the site is in. `none` hands the
  // decision to the scheduled seasonal theme, as before; anything else turns
  // the decorations on at the chosen intensity, honouring the one switch.
  const appearance = await getAppearance();
  if (appearance.season === 'halloween' || appearance.season === 'nocturne') {
    const record = (await getThemeRecords()).find((entry) => entry.slug === 'autumn-evening');
    const on = appearance.decorationsEnabled;
    return resolveTheme(
      'autumn-evening',
      {
        assets: record?.config.assets ?? {},
        options: { texture: on, glow: on, petals: on, edges: on, motion: on },
        intensity: appearance.decorationIntensity === 'lively' ? 'standard' : 'subtle',
      },
      'manual',
    );
  }

  const now = new Date();
  const live = (await getThemeRecords()).find((record) => isThemeActiveAt(record, now));
  if (!live) return DEFAULT_RESOLVED;
  return resolveTheme(live.slug, live.config, live.scheduleEnabled ? 'scheduled' : 'manual');
});

/**
 * A theme with its config and artwork fully resolved.
 *
 * Asset overrides are `media_assets` ids, so they go through the same media map
 * every photograph on the site uses — an archived or missing upload falls back
 * to the shipped artwork rather than to a broken image.
 */
export async function resolveTheme(
  slug: SeasonalThemeSlug,
  config: ThemeConfig | undefined,
  source: ResolvedTheme['source'],
): Promise<ResolvedTheme> {
  const definition = getThemeDefinition(slug)!;
  const normalized = normalizeConfig(config, definition.defaults);
  const media = Object.keys(normalized.assets).length > 0 ? await getMediaMap() : null;

  const assets = Object.fromEntries(
    THEME_ASSET_SLOTS.map((slot) => {
      const spec = definition.assets[slot];
      const overrideId = normalized.assets[slot];
      const override = overrideId && media ? media[overrideId] : null;
      if (override?.path) {
        const kind = override.kind === 'video' ? 'video' : 'image';
        return [slot, { path: override.path, kind, overridden: true } satisfies ResolvedThemeAsset];
      }
      return [
        slot,
        {
          path: spec.defaultPath,
          kind: spec.defaultKind ?? 'image',
          overridden: false,
        } satisfies ResolvedThemeAsset,
      ];
    }),
  ) as ResolvedTheme['assets'];

  return {
    slug,
    definition,
    config: normalized,
    preset: presetFor(normalized.intensity),
    assets,
    source,
  };
}
