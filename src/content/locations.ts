

export interface Location {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  street: string | null;
  locality: string | null;
  region: string | null;
  postalCode: string | null;
  timezone: string;
  phone: string | null;
  active: boolean;
  sort: number;
}


export const CHICAGO_LOCATION_ID = 'c05a0000-0000-4000-8000-000000000001';

export const chicago: Location = {
  id: CHICAGO_LOCATION_ID,
  slug: 'chicago',
  name: 'Casa Aurelia Chicago',
  shortName: 'Chicago',
  street: 'West Loop',
  locality: 'Chicago',
  region: 'IL',
  postalCode: '',
  timezone: 'America/Chicago',
  phone: '(312) 555-0147',
  active: true,
  sort: 0,
};

/** The location a record with no location_id belongs to. */
export const DEFAULT_LOCATION = chicago;

export const staticLocations: Location[] = [chicago];

export function locationAddress(location: Location): string {
  return [location.street, [location.locality, location.region].filter(Boolean).join(', '), location.postalCode]
    .filter(Boolean)
    .join(', ')
    .replace(', ,', ',');
}
