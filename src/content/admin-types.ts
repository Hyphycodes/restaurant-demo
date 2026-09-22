import type { Availability, PriceMode } from './labels';
import type { Dietary, MenuSlug } from './types';

/**
 * View models the admin's server and client components both need.
 *
 * They live outside `src/server/` on purpose. Those modules start with
 * `import 'server-only'` — the marker that makes it a build error to pull them
 * into the browser bundle, and the thing that actually keeps the service-role key
 * server-side. A client component importing a type from one of them would drag
 * the whole module into the graph and trip that guard, so the shapes live here
 * and the server modules re-export them.
 */

export type EditorialState = 'draft' | 'published' | 'changed' | 'archived';

export interface ActionState {
  ok: boolean;
  message: string;
  /** Public routes this change altered, so the UI can offer to open them. */
  affected?: string[];
  /** Field-level problems, keyed by input name. */
  errors?: Record<string, string>;
}

export interface VersionEntry {
  id: string;
  at: string;
  label: string;
  actorName: string;
  snapshot: Record<string, unknown>;
}

/* --------------------------------------------------------------------- menu */

export interface AdminMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceMode: PriceMode;
  priceCents: number | null;
  priceNote: string | null;
  modifierGroupLabel: string | null;
  modifiers: { id: string; label: string; priceCents: number | null; sort: number }[];
  dietary: Dietary[];
  availability: Availability;
  availabilityNote: string | null;
  featured: boolean;
  mediaAssetId: string | null;
  sort: number;
  state: EditorialState;
  /** Which fields differ between the draft and what is live. */
  changedFields: string[];
}

export interface AdminMenuCategory {
  id: string;
  menuSlug: MenuSlug;
  name: string;
  note: string | null;
  sort: number;
  state: EditorialState;
  items: AdminMenuItem[];
}

export interface AdminMenu {
  slug: MenuSlug;
  title: string;
  note: string | null;
  emptyState: string | null;
  sort: number;
  state: EditorialState;
  categories: AdminMenuCategory[];
}

/* -------------------------------------------------------------------- media */

export interface MediaUsage {
  
  label: string;
  /** Where to go to change it. */
  href: string;
  /** Which public route it appears on, for the warning copy. */
  route: string;
}

export interface AdminMedia {
  assetId: string;
  path: string | null;
  title: string;
  alt: string | null;
  decorative: boolean;
  kind: 'image' | 'video' | 'texture';
  width: number;
  height: number;
  ratio: string;
  focal: string;
  poster: string | null;
  status: string;
  tags: string[];
  sizeBytes: number | null;
  mime: string | null;
  durationSeconds: number | null;
  state: EditorialState;
  archivedAt: string | null;
  usage: MediaUsage[];
  /** Placements recorded in the registry that no record points at any more. */
  registryUsage: string[];
}

/* -------------------------------------------------------------------- pages */

export interface AdminPageSection {
  id: string;
  page: string;
  key: string;
  eyebrow: string | null;
  heading: string;
  body: string | null;
  visible: boolean;
  variant: 'editorial-left' | 'editorial-right' | 'stagger' | 'band' | 'plain';
  mediaAssetId: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  sort: number;
}
