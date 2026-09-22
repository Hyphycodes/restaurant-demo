import 'server-only';

import { cache } from 'react';
import { getReadDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import {
  DEFAULT_APPEARANCE,
  PRESETS,
  SEASONS,
  type Appearance,
  type Intensity,
  type PresetName,
  type Season,
} from '@/lib/appearance/presets';

/**
 * The one appearance row, read once per minute and again the moment it is
 * saved (`revalidateTag('appearance')`). Never throws: with no database or a
 * bad row the site wears Evening.
 */

export const APPEARANCE_TAG = 'appearance';

export function rowToAppearance(row: Row | null): Appearance {
  if (!row) return DEFAULT_APPEARANCE;
  const preset = (PRESETS as readonly string[]).includes(String(row.preset)) ? (row.preset as PresetName) : 'evening';
  const season = (SEASONS as readonly string[]).includes(String(row.season)) ? (row.season as Season) : 'none';
  const hex = (value: unknown) => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null);
  return {
    preset,
    surfaceHex: hex(row.surface_hex),
    accentHex: hex(row.accent_hex),
    season,
    decorationsEnabled: row.decorations_enabled !== false,
    decorationIntensity: (row.decoration_intensity === 'lively' ? 'lively' : 'subtle') as Intensity,
    adminFollowsSite: row.admin_follows_site !== false,
  };
}

async function load(): Promise<Appearance> {
  const db = getReadDb();
  if (!db) return DEFAULT_APPEARANCE;
  try {
    const rows = await Promise.race([
      db.list<Row>('appearance', { limit: 1 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]);
    return rowToAppearance(rows?.[0] ?? null);
  } catch (error) {
    console.error('[appearance] falling back to Evening:', error);
    return DEFAULT_APPEARANCE;
  }
}

export const getAppearance = cache(load);

export function appearanceToRow(appearance: Appearance, updatedBy: string | null): Row {
  return {
    id: 1,
    preset: appearance.preset,
    surface_hex: appearance.surfaceHex,
    accent_hex: appearance.accentHex,
    season: appearance.season,
    decorations_enabled: appearance.decorationsEnabled,
    decoration_intensity: appearance.decorationIntensity,
    admin_follows_site: appearance.adminFollowsSite,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
}
