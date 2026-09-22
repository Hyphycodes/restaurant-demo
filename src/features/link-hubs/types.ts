export const HUB_TYPES = [
  'instagram-bio',
  'live',
  'event',
  'artist',
  'hiring',
  'private-events',
  'custom',
] as const;

export type LinkHubType = (typeof HUB_TYPES)[number];
export type LinkHubStatus = 'draft' | 'published' | 'archived';
export type HubTheme = 'cosa-nostra-default' | 'evening' | 'teal' | 'plum' | 'seasonal' | 'custom';
export type SearchVisibility = 'searchable' | 'noindex';
export type ModeStrategy = 'auto' | 'manual';

export const BLOCK_TYPES = [
  'link',
  'events',
  'featured-event',
  'review',
  'reservation',
  'directions',
  'call',
  'social',
  'menu',
  'tickets',
  'private-event',
  'birthday',
  'contact',
  'artist',
  'lead',
  'text',
  'image',
  'divider',
] as const;

export type HubBlockType = (typeof BLOCK_TYPES)[number];
export type ButtonStyle = 'standard' | 'featured' | 'glass' | 'outline' | 'image' | 'glow' | 'minimal';

export interface LinkHubLocation {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  reviewUrl: string | null;
  directionsUrl: string | null;
  reservationUrl: string | null;
  menuUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  contactEmail: string | null;
  enabled: boolean;
}

export interface LinkHub {
  id: string;
  locationId: string | null;
  name: string;
  slug: string;
  internalDescription: string;
  hubType: LinkHubType;
  theme: HubTheme;
  status: LinkHubStatus;
  title: string;
  subtitle: string | null;
  logoAssetId: string | null;
  backgroundAssetId: string | null;
  heroAssetId: string | null;
  customTheme: Record<string, string>;
  startAt: string | null;
  endAt: string | null;
  modeStrategy: ModeStrategy;
  manualModeId: string | null;
  searchVisibility: SearchVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface LinkHubMode {
  id: string;
  hubId: string;
  name: string;
  titleOverride: string | null;
  subtitleOverride: string | null;
  enabled: boolean;
  priority: number;
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  startsOn: string | null;
  endsOn: string | null;
  activeEventOnly: boolean;
}

export interface HubBlockConfig {
  title?: string;
  subtitle?: string;
  url?: string;
  icon?: string;
  imageAssetId?: string;
  style?: ButtonStyle;
  emphasis?: 'normal' | 'high';
  newTab?: boolean;
  eventCount?: 1 | 3;
  eventCategory?: string;
  featuredOnly?: boolean;
  showArtwork?: boolean;
  showTicketCta?: boolean;
  platform?: 'instagram' | 'tiktok' | 'facebook';
  artistName?: string;
  artistBio?: string;
  artistImageAssetId?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  portfolioUrl?: string;
  bookingUrl?: string;
  body?: string;
  align?: 'left' | 'center';
  collectPhone?: boolean;
  collectBirthday?: boolean;
  successMessage?: string;
  height?: 'sm' | 'md' | 'lg';
}

export interface LinkHubBlock {
  id: string;
  hubId: string;
  modeId: string | null;
  blockType: HubBlockType;
  label: string;
  config: HubBlockConfig;
  sort: number;
  visible: boolean;
  startAt: string | null;
  endAt: string | null;
}

export interface HubMediaAsset {
  id: string;
  title: string;
  path: string;
  alt: string;
  width: number;
  height: number;
  kind: 'image' | 'video';
  focal: string;
}

export interface HubEventCard {
  id: string;
  title: string;
  date: string;
  time: string;
  href: string;
  ticketUrl: string | null;
  artwork: HubMediaAsset | null;
  category: string | null;
  featured: boolean;
  startsAt: string;
  endsAt: string;
}

export interface HubPageData {
  hub: LinkHub;
  location: LinkHubLocation | null;
  mode: LinkHubMode | null;
  blocks: LinkHubBlock[];
  media: Record<string, HubMediaAsset>;
  events: HubEventCard[];
  preview?: boolean;
}

export interface HubEditorData {
  hub: LinkHub;
  location: LinkHubLocation | null;
  locations: LinkHubLocation[];
  modes: LinkHubMode[];
  blocks: LinkHubBlock[];
  media: HubMediaAsset[];
  events: HubEventCard[];
}

export type HubTemplate = 'main-links' | 'live' | 'vinyl-club' | 'nightlife' | 'artist' | 'hiring' | 'blank';
