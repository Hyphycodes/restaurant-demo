import 'server-only';

import type { Db, Row } from '@/lib/db/types';
import { normalizeConfig } from '@/themes/config';
import { isSeasonalSlug, THEMES } from '@/themes/registry';
import type { SeasonalThemeSlug, ThemeConfig, ThemeRecord } from '@/themes/types';

/**
 * `site_themes` rows, typed.
 *
 * One row per seasonal theme. A theme with no row yet is simply off, so the
 * public site and the admin both work before the first save — and before the
 * migration has been applied, since a missing table reads as no rows.
 */

export const THEME_TABLE = 'site_themes';

export function rowToRecord(row: Row): ThemeRecord | null {
  const slug = row.slug;
  if (!isSeasonalSlug(slug)) return null;
  return {
    slug,
    enabled: Boolean(row.enabled),
    scheduleEnabled: Boolean(row.schedule_enabled),
    startAt: (row.start_at as string | null) ?? null,
    endAt: (row.end_at as string | null) ?? null,
    config: normalizeConfig(row.config, THEMES[slug].defaults),
    updatedAt: (row.updated_at as string | null) ?? null,
  };
}

export function recordToRow(record: ThemeRecord): Row {
  return {
    slug: record.slug,
    name: THEMES[record.slug].name,
    enabled: record.enabled,
    schedule_enabled: record.scheduleEnabled,
    start_at: record.startAt,
    end_at: record.endAt,
    config: record.config,
  };
}

export async function listThemeRecords(db: Db): Promise<ThemeRecord[]> {
  const rows = await db.list<Row>(THEME_TABLE);
  return rows.map(rowToRecord).filter((record): record is ThemeRecord => record !== null);
}

/** The stored record for a theme, or a fresh disabled one carrying its defaults. */
export async function getThemeRecord(db: Db, slug: SeasonalThemeSlug): Promise<ThemeRecord> {
  const row = await db.get<Row>(THEME_TABLE, slug);
  return (row && rowToRecord(row)) ?? emptyRecord(slug);
}

export function emptyRecord(slug: SeasonalThemeSlug, config?: ThemeConfig): ThemeRecord {
  return {
    slug,
    enabled: false,
    scheduleEnabled: false,
    startAt: null,
    endAt: null,
    config: config ?? THEMES[slug].defaults,
    updatedAt: null,
  };
}
