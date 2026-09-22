

export type TalentDiscipline =
  | 'dj'
  | 'musician'
  | 'singer'
  | 'painter'
  | 'photographer'
  | 'dancer'
  | 'comedian'
  | 'instructor'
  | 'chef'
  | 'host'
  | 'event_idea'
  | 'other';

export interface DisciplineInfo {
  id: TalentDiscipline;
  /** What it is called on the form and on the card. */
  label: string;
  /** The contractor service type this becomes when they are booked. */
  service: 'dj' | 'instructor' | 'painter' | 'band' | 'performer' | 'photographer' | 'security' | 'other';
}

export const TALENT_DISCIPLINES: DisciplineInfo[] = [
  { id: 'dj', label: 'DJ', service: 'dj' },
  { id: 'musician', label: 'Musician or band', service: 'band' },
  { id: 'singer', label: 'Singer', service: 'performer' },
  { id: 'painter', label: 'Painter or visual artist', service: 'painter' },
  { id: 'photographer', label: 'Photographer or videographer', service: 'photographer' },
  { id: 'dancer', label: 'Dancer', service: 'performer' },
  { id: 'comedian', label: 'Comedian', service: 'performer' },
  { id: 'instructor', label: 'Workshop host — pasta, wine, hospitality', service: 'instructor' },
  { id: 'chef', label: 'Chef or guest kitchen', service: 'other' },
  { id: 'host', label: 'Host or MC', service: 'performer' },
  { id: 'event_idea', label: 'I have an idea for a night', service: 'other' },
  { id: 'other', label: 'Something else', service: 'other' },
];

export const TALENT_DISCIPLINE_LABEL: Record<TalentDiscipline, string> = Object.fromEntries(
  TALENT_DISCIPLINES.map((entry) => [entry.id, entry.label]),
) as Record<TalentDiscipline, string>;

export function isTalentDiscipline(value: string): value is TalentDiscipline {
  return TALENT_DISCIPLINES.some((entry) => entry.id === value);
}

/** Which contractor service type a discipline becomes on the roster. */
export function serviceTypeFor(discipline: TalentDiscipline): DisciplineInfo['service'] {
  return TALENT_DISCIPLINES.find((entry) => entry.id === discipline)?.service ?? 'other';
}

export type TalentStatus = 'new' | 'interested' | 'contacted' | 'booked' | 'featured' | 'archived';

export const TALENT_STATUSES: TalentStatus[] = [
  'new',
  'interested',
  'contacted',
  'booked',
  'featured',
  'archived',
];

export const TALENT_STATUS_LABEL: Record<TalentStatus, string> = {
  new: 'New',
  interested: 'Interested',
  contacted: 'Contacted',
  booked: 'Booked',
  featured: 'Featured',
  archived: 'Archived',
};

export interface TalentLink {
  /** As typed, normalised to an absolute https URL. */
  url: string;
  /** instagram.com, tiktok.com … — what the chip says. */
  host: string;
  /** @handle where the platform has one, otherwise the path. */
  label: string;
}

export interface TalentSubmission {
  id: string;
  reference: string;
  name: string;
  email: string | null;
  phone: string | null;
  discipline: TalentDiscipline;
  pitch: string;
  links: string[];
  mediaPaths: string[];
  idea: string | null;
  notes: string | null;
  locationId: string | null;
  status: TalentStatus;
  staffNotes: string | null;
  contractorId: string | null;
  createdAt: string;
}

const PLATFORMS: { match: RegExp; name: string }[] = [
  { match: /(^|\.)instagram\.com$/i, name: 'Instagram' },
  { match: /(^|\.)tiktok\.com$/i, name: 'TikTok' },
  { match: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, name: 'YouTube' },
  { match: /(^|\.)facebook\.com$|(^|\.)fb\.com$/i, name: 'Facebook' },
  { match: /(^|\.)soundcloud\.com$/i, name: 'SoundCloud' },
  { match: /(^|\.)spotify\.com$/i, name: 'Spotify' },
  { match: /(^|\.)mixcloud\.com$/i, name: 'Mixcloud' },
  { match: /(^|\.)bandcamp\.com$/i, name: 'Bandcamp' },
  { match: /(^|\.)linktr\.ee$/i, name: 'Linktree' },
  { match: /(^|\.)vimeo\.com$/i, name: 'Vimeo' },
  { match: /(^|\.)behance\.net$/i, name: 'Behance' },
  { match: /(^|\.)x\.com$|(^|\.)twitter\.com$/i, name: 'X' },
];

/**
 * A stored URL as something readable on a card.
 *
 * Never throws: a row already in the database has to render even if a future
 * change lets something odd through.
 */
export function describeLink(raw: string): TalentLink {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');
    const platform = PLATFORMS.find((entry) => entry.match.test(host));
    const segment = url.pathname.split('/').filter(Boolean)[0] ?? '';
    if (platform && segment) {
      const handle = segment.startsWith('@') ? segment : `@${segment}`;
      return { url: raw, host: platform.name, label: `${platform.name} ${handle}` };
    }
    return { url: raw, host, label: host + (url.pathname === '/' ? '' : url.pathname) };
  } catch {
    return { url: raw, host: raw, label: raw };
  }
}
