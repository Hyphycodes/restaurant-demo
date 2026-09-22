import type { SiteSettings } from '@/content/types';
import { getOpenState, groupHours, type HoursGroup, type OpenState } from './hours';



export interface MapLinks {
  apple: string;
  google: string;
  waze: string;
}

export interface VisitLocation {
  id: string;
  
  name: string;
  
  shortName: string;
  /** Street on one line, town/state/zip on the next. */
  street: string;
  cityLine: string;
  /** One line, for a map query and for structured data. */
  addressOneLine: string;
  phone: string;
  hours: HoursGroup[];
  open: OpenState;
  maps: MapLinks;
  /** The photograph of this place, by semantic id. */
  photoAssetId: string;
}


export function mapLinks(address: string, geo: { lat: number; lng: number } | null): MapLinks {
  const query = encodeURIComponent(address);
  const point = geo ? `${geo.lat},${geo.lng}` : null;
  return {
    apple: point
      ? `https://maps.apple.com/?daddr=${point}&q=${query}&dirflg=d`
      : `https://maps.apple.com/?daddr=${query}&dirflg=d`,
    google: point
      ? `https://www.google.com/maps/dir/?api=1&destination=${point}`
      : `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    waze: point
      ? `https://www.waze.com/ul?ll=${point}&navigate=yes`
      : `https://www.waze.com/ul?q=${query}&navigate=yes`,
  };
}

export function buildVisitLocations(site: SiteSettings, now: Date = new Date()): VisitLocation[] {
  const cityLine = `${site.locality}, ${site.region} ${site.postalCode}`;
  const addressOneLine = `${site.name}, ${site.street}, ${cityLine}`;

  return [
    {
      id: 'chicago',
      name: site.name,
      shortName: site.locality,
      street: site.street,
      cityLine,
      addressOneLine,
      phone: site.phone.value,
      hours: groupHours(site.hours.value),
      open: getOpenState(site.hours.value, site.temporaryClosures, now, site.timeZone),
      maps: {apple:'/contact#location',google:'/contact#location',waze:'/contact#location'},
      photoAssetId: 'exteriorSign',
    },
  ];
}
