import 'server-only';

import { cache } from 'react';
import { allMenus } from '@/content/menu';
import {
  AVAILABILITY_HELP,
  AVAILABILITY_LABEL,
  PRICE_MODE_LABEL,
  type Availability,
  type PriceMode,
} from '@/content/labels';
import type {
  AdminMenu,
  AdminMenuCategory,
  AdminMenuItem,
} from '@/content/admin-types';
import type { Dietary, Menu, MenuItem, MenuSlug } from '@/content/types';
import { getReadDb } from '@/lib/db';
import type { Db, Row } from '@/lib/db/types';
import { liveValues, stateOf, workingValues, type EditorialRow } from './editorial';

/**
 * Menus, for the public site and for the admin.
 *
 * One loader, one difference: a public read takes the live columns and drops
 * anything hidden or archived; an admin read takes live-plus-draft and keeps
 * everything, with its state attached. There is no second query path that could
 * forget the filter.
 */

export type { PriceMode, Availability };
export type { AdminMenu, AdminMenuCategory, AdminMenuItem };
export { AVAILABILITY_HELP, AVAILABILITY_LABEL, PRICE_MODE_LABEL };

/* -------------------------------------------------------------------------- */

function toPublicItem(row: Row, modifiers: Row[]): MenuItem | null {
  const source = liveValues(row as EditorialRow);
  if (source.archived_at) return null;

  const availability = (source.availability as Availability) ?? 'available';
  if (availability === 'hidden') return null;

  const priceModeValue = (source.price_mode as PriceMode) ?? 'fixed';

  return {
    id: String(source.id),
    name: String(source.name ?? ''),
    description: (source.description as string | null) ?? null,
    // A non-fixed mode must not leak a stale number. The database trigger nulls
    // it too; this is the second, independent guard.
    priceCents: priceModeValue === 'fixed' ? ((source.price_cents as number | null) ?? null) : null,
    priceNote:
      priceModeValue === 'fixed' ? null : ((source.price_note as string | null) ?? 'Ask your server'),
    modifierGroupLabel: (source.modifier_group_label as string | null) ?? null,
    modifiers: modifiers
      .filter((modifier) => modifier.item_id === source.id)
      .sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0))
      .map((modifier) => ({
        label: String(modifier.label),
        priceCents: (modifier.price_cents as number | null) ?? null,
      })),
    dietary: ((source.dietary as Dietary[]) ?? []) as Dietary[],
    available: availability === 'available',
    featured: Boolean(source.featured),
    imageAssetId: (source.media_asset_id as string | null) ?? null,
  };
}

async function loadPublic(db: Db): Promise<Menu[] | null> {
  const [menuRows, categoryRows, itemRows, modifierRows] = await Promise.all([
    db.list<Row>('menus', { orderBy: 'sort' }),
    db.list<Row>('menu_categories', { orderBy: 'sort' }),
    db.list<Row>('menu_items', { orderBy: 'sort' }),
    db.list<Row>('menu_modifiers', { orderBy: 'sort' }),
  ]);

  if (menuRows.length === 0) return null;

  return menuRows
    .filter((row) => !row.archived_at)
    .map((menuRow): Menu => {
      const menu = liveValues(menuRow as EditorialRow);
      return {
        slug: String(menu.slug) as MenuSlug,
        title: String(menu.title ?? ''),
        note: (menu.note as string | null) ?? null,
        emptyState: (menu.empty_state as string | null) ?? null,
        categories: categoryRows
          .filter((row) => row.menu_slug === menu.slug && !row.archived_at)
          .map((categoryRow) => {
            const category = liveValues(categoryRow as EditorialRow);
            return {
              id: String(category.id),
              name: String(category.name ?? ''),
              note: (category.note as string | null) ?? null,
              items: itemRows
                .filter((row) => row.category_id === category.id)
                .map((row) => toPublicItem(row, modifierRows))
                .filter((item): item is MenuItem => item !== null),
            };
          })
          // An empty category is a heading over nothing. It stays in the admin;
          // it does not go on the page.
          .filter((category) => category.items.length > 0),
      };
    });
}

/**
 * Published menus for the public site.
 *
 * Falls back to the typed static menus when there is no database or the query
 * fails, which is what keeps the menu on screen during an outage.
 */
export const getPublicMenus = cache(async (): Promise<Menu[]> => {
  const db = getReadDb();
  if (!db) return allMenus;
  try {
    return (await loadPublic(db)) ?? allMenus;
  } catch (error) {
    console.error('[menu] falling back to static content:', error);
    return allMenus;
  }
});

export async function getPublicMenu(slug: MenuSlug): Promise<Menu> {
  const menus = await getPublicMenus();
  return menus.find((menu) => menu.slug === slug) ?? allMenus.find((m) => m.slug === slug)!;
}

/* -------------------------------------------------------------------------- */

/** Admin read: drafts, hidden items and archived rows all included, labelled. */
export async function getEditableMenus(db: Db): Promise<AdminMenu[]> {
  const [menuRows, categoryRows, itemRows, modifierRows] = await Promise.all([
    db.list<Row>('menus', { orderBy: 'sort' }),
    db.list<Row>('menu_categories', { orderBy: 'sort' }),
    db.list<Row>('menu_items', { orderBy: 'sort' }),
    db.list<Row>('menu_modifiers', { orderBy: 'sort' }),
  ]);

  return menuRows.map((menuRow): AdminMenu => {
    const menu = workingValues(menuRow as EditorialRow);
    return {
      slug: String(menu.slug) as MenuSlug,
      title: String(menu.title ?? ''),
      note: (menu.note as string | null) ?? null,
      emptyState: (menu.empty_state as string | null) ?? null,
      sort: Number(menu.sort ?? 0),
      state: stateOf(menuRow as EditorialRow),
      categories: categoryRows
        .filter((row) => row.menu_slug === menu.slug)
        .map((categoryRow): AdminMenuCategory => {
          const category = workingValues(categoryRow as EditorialRow);
          return {
            id: String(category.id),
            menuSlug: String(menu.slug) as MenuSlug,
            name: String(category.name ?? ''),
            note: (category.note as string | null) ?? null,
            sort: Number(category.sort ?? 0),
            state: stateOf(categoryRow as EditorialRow),
            items: itemRows
              .filter((row) => row.category_id === category.id)
              .map((row): AdminMenuItem => {
                const item = workingValues(row as EditorialRow);
                const draft = ((row as EditorialRow).draft as Row) ?? {};
                return {
                  id: String(item.id),
                  categoryId: String(item.category_id),
                  name: String(item.name ?? ''),
                  description: (item.description as string | null) ?? null,
                  priceMode: (item.price_mode as PriceMode) ?? 'fixed',
                  priceCents: (item.price_cents as number | null) ?? null,
                  priceNote: (item.price_note as string | null) ?? null,
                  modifierGroupLabel: (item.modifier_group_label as string | null) ?? null,
                  modifiers: (Array.isArray(item._modifiers) ? (item._modifiers as Row[]) : modifierRows.filter((modifier) => modifier.item_id === item.id))
                    .sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0))
                    .map((modifier) => ({
                      id: String(modifier.id),
                      label: String(modifier.label),
                      priceCents: (modifier.price_cents as number | null) ?? null,
                      sort: Number(modifier.sort ?? 0),
                    })),
                  dietary: ((item.dietary as Dietary[]) ?? []) as Dietary[],
                  availability: (item.availability as Availability) ?? 'available',
                  availabilityNote: (item.availability_note as string | null) ?? null,
                  featured: Boolean(item.featured),
                  mediaAssetId: (item.media_asset_id as string | null) ?? null,
                  sort: Number(item.sort ?? 0),
                  state: stateOf(row as EditorialRow),
                  changedFields: Object.keys(draft),
                };
              })
              .sort((a, b) => a.sort - b.sort),
          };
        })
        .sort((a, b) => a.sort - b.sort),
    };
  });
}

/** Everything an item's price should be, given a mode and a typed amount. */
export function priceFields(mode: PriceMode, amount: string): Row {
  if (mode !== 'fixed') {
    return {
      price_mode: mode,
      price_cents: null,
      price_note:
        mode === 'market' ? 'Market price' : mode === 'hidden' ? 'Not shown' : 'Ask your server',
    };
  }

  const cleaned = amount.replace(/[$,\s]/g, '');
  const value = Number(cleaned);
  if (!cleaned || !Number.isFinite(value) || value < 0) {
    throw new Error('Enter the price as a number, for example 16 or 16.50.');
  }
  // Money is stored in whole cents. Rounding here, once, is what keeps 16.50
  // from becoming 1649.9999999999998 somewhere downstream.
  return { price_mode: 'fixed', price_cents: Math.round(value * 100), price_note: null };
}
