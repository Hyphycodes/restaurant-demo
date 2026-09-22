import 'server-only';

import type { LocationSummary } from '@/content/staff-types';
import { DEFAULT_LOCATION, staticLocations } from '@/content/locations';
import type { Db, Row } from '@/lib/db/types';

export function locationFromRow(row: Row): LocationSummary {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    shortName: String(row.short_name ?? row.name),
    timezone: String(row.timezone ?? DEFAULT_LOCATION.timezone),
    active: row.active !== false,
  };
}

const fallback: LocationSummary[] = staticLocations.map((location) => ({
  id: location.id,
  slug: location.slug,
  name: location.name,
  shortName: location.shortName,
  timezone: location.timezone,
  active: location.active,
}));


export async function listLocations(db: Db): Promise<LocationSummary[]> {
  try {
    const rows = await db.list<Row>('locations', { orderBy: 'sort' });
    return rows.length > 0 ? rows.map(locationFromRow) : fallback;
  } catch {
    return fallback;
  }
}

export async function locationMap(db: Db): Promise<Map<string, LocationSummary>> {
  const list = await listLocations(db);
  return new Map(list.map((location) => [location.id, location]));
}

/** The location a record with a possibly-null location_id belongs to. */
export function resolveLocation(map: Map<string, LocationSummary>, id: string | null | undefined): LocationSummary {
  return (id && map.get(id)) || map.get(DEFAULT_LOCATION.id) || fallback[0]!;
}

export async function saveLocation(
  db: Db,
  input: { id?: string; slug: string; name: string; shortName: string | null; street: string | null; locality: string | null; region: string | null; postalCode: string | null; timezone: string; phone: string | null; active: boolean },
): Promise<LocationSummary> {
  const row = {
    slug: input.slug,
    name: input.name,
    short_name: input.shortName,
    street: input.street,
    locality: input.locality,
    region: input.region,
    postal_code: input.postalCode,
    timezone: input.timezone,
    phone: input.phone,
    active: input.active,
  };
  const saved = input.id ? await db.update<Row>('locations', input.id, row) : await db.insert<Row>('locations', { ...row, sort: 100 });
  return locationFromRow(saved);
}
