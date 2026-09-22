import 'server-only';

import { cache } from 'react';
import { homeSections, pageCopy } from '@/content/pages';
import type { AdminPageSection } from '@/content/admin-types';
import type { PageSection as BasePageSection } from '@/content/types';
import { getReadDb } from '@/lib/db';
import type { Db, Row } from '@/lib/db/types';
import { liveValues, workingValues, type EditorialRow } from './editorial';

/**
 * Named page content.
 *
 * Every editable slot corresponds to a section the public design already has —
 * the homepage hero, the After Dark band, a route opener. Staff choose the words
 * and the photograph in a slot; they cannot invent slots, reorder the page or
 * author layout. That is the difference between this and a page builder, and it
 * is enforced by the fact that a section only renders if a component asks for it
 * by key.
 *
 * Business facts — address, hours, phone, ordering links — are NOT here. They
 * live once, in site settings, and every page references them.
 */

/**
 * A named slot, extending the shape the presentation components already take.
 * `variant` stays a closed union: editors pick from approved layouts, they do
 * not author one.
 */
export type PageSection = AdminPageSection;

const VARIANTS: BasePageSection['variant'][] = [
  'editorial-left',
  'editorial-right',
  'stagger',
  'band',
  'plain',
];

function variantOf(value: unknown): BasePageSection['variant'] {
  const candidate = String(value ?? 'plain') as BasePageSection['variant'];
  return VARIANTS.includes(candidate) ? candidate : 'plain';
}

/** Fallback copy, so a page renders correctly with no database at all. */
const STATIC_SECTIONS: Record<string, PageSection> = (() => {
  const map: Record<string, PageSection> = {};

  homeSections.forEach((section, index) => {
    map[`home:${section.key}`] = {
      id: `home:${section.key}`,
      page: 'home',
      key: section.key,
      eyebrow: section.eyebrow,
      heading: section.heading,
      body: section.body,
      visible: section.visible,
      variant: section.variant,
      mediaAssetId: null,
      ctaLabel: null,
      ctaHref: null,
      sort: index,
    };
  });

  const openers: [string, { eyebrow?: string; heading: string; body?: string }][] = [
    ['menu', pageCopy.menu],
    ['events', pageCopy.events],
    ['catering', pageCopy.catering],
    ['private-events', pageCopy.privateEvents],
    ['visit', pageCopy.visit],
    ['careers', pageCopy.careers],
    ['contact', pageCopy.contact],
    ['talent', pageCopy.talent],
  ];

  openers.forEach(([page, copy], index) => {
    map[`${page}:opener`] = {
      id: `${page}:opener`,
      page,
      key: 'opener',
      eyebrow: copy.eyebrow ?? null,
      heading: copy.heading,
      body: copy.body ?? null,
      visible: true,
      variant: 'plain',
      mediaAssetId: null,
      ctaLabel: null,
      ctaHref: null,
      sort: index,
    };
  });

  map['home:hero'] = {
    id: 'home:hero',
    page: 'home',
    key: 'hero',
    eyebrow: 'Chicago, Illinois',
    heading: pageCopy.home.heroHeadlineLines.join(' '),
    body: pageCopy.home.heroBody,
    visible: true,
    variant: 'band',
    mediaAssetId: 'heroImage',
    ctaLabel: null,
    ctaHref: null,
    sort: -1,
  };

  return map;
})();

function fromRow(row: Row, mode: 'published' | 'working'): PageSection {
  const source = mode === 'working' ? workingValues(row as EditorialRow) : liveValues(row as EditorialRow);
  return {
    id: String(source.id),
    page: String(source.page),
    key: String(source.key),
    eyebrow: (source.eyebrow as string | null) ?? null,
    heading: String(source.heading ?? ''),
    body: (source.body as string | null) ?? null,
    visible: source.visible !== false,
    variant: variantOf(source.variant),
    mediaAssetId: (source.media_asset_id as string | null) ?? null,
    ctaLabel: (source.cta_label as string | null) ?? null,
    ctaHref: (source.cta_href as string | null) ?? null,
    sort: Number(source.sort ?? 0),
  };
}

const loadPublished = cache(async (): Promise<Record<string, PageSection>> => {
  const db = getReadDb();
  if (!db) return STATIC_SECTIONS;
  try {
    const rows = await db.list<Row>('page_sections', { orderBy: 'sort' });
    if (rows.length === 0) return STATIC_SECTIONS;
    const map: Record<string, PageSection> = { ...STATIC_SECTIONS };
    for (const row of rows) {
      if (row.archived_at) continue;
      const section = fromRow(row, 'published');
      map[section.id] = section;
    }
    return map;
  } catch (error) {
    console.error('[pages] falling back to static copy:', error);
    return STATIC_SECTIONS;
  }
});

/** One named slot. Falls back to the typed default rather than rendering blank. */
export async function getPageCopy(page: string, key = 'opener'): Promise<PageSection> {
  const map = await loadPublished();
  return map[`${page}:${key}`] ?? STATIC_SECTIONS[`${page}:${key}`] ?? {
    id: `${page}:${key}`,
    page,
    key,
    eyebrow: null,
    heading: '',
    body: null,
    visible: true,
    variant: 'plain',
    mediaAssetId: null,
    ctaLabel: null,
    ctaHref: null,
    sort: 0,
  };
}

/** Every visible section on a page, in display order. */
export async function getPageSections(page: string): Promise<PageSection[]> {
  const map = await loadPublished();
  return Object.values(map)
    .filter((section) => section.page === page)
    .sort((a, b) => a.sort - b.sort);
}

/** Admin read: drafts included. */
export async function getEditableSections(db: Db, page?: string): Promise<PageSection[]> {
  const rows = await db.list<Row>('page_sections', { orderBy: 'sort' });
  return rows
    .map((row) => fromRow(row, 'working'))
    .filter((section) => !page || section.page === page)
    .sort((a, b) => a.sort - b.sort);
}

/* ----------------------------------------------------------- option lists -- */

const STATIC_LISTS: Record<string, string[]> = {
  // Positions are not here: an opening is a row in `job_openings`, with a
  // description and a switch, not a string in a list. See migration 0026.
  'careers:perks': [...pageCopy.careers.perks],
  'private-events:types': [
    'Birthday',
    'Rehearsal dinner',
    'Graduation',
    'Company dinner',
    'Engagement celebration',
    'Other celebration',
  ],
};

/**
 * An editable option list — the choices in an enquiry form, the perks on the
 * careers page. Only the visible options are editable; the field names,
 * validation, spam protection and delivery are not.
 */
export const getPageList = cache(async (page: string, key: string): Promise<string[]> => {
  const fallback = STATIC_LISTS[`${page}:${key}`] ?? [];
  const db = getReadDb();
  if (!db) return fallback;
  try {
    const row = await db.get<EditorialRow>('page_lists', `${page}:${key}`);
    if (!row || row.archived_at) return fallback;
    const items = liveValues(row).items as string[] | undefined;
    return items?.length ? items : fallback;
  } catch {
    return fallback;
  }
});

export { STATIC_LISTS };
