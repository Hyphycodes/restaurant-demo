/**
 * How an event presents itself on the website.
 *
 * Separate from what an event IS (title, date, tickets) because these are
 * art-direction choices the admin makes, and because the vocabulary has to be
 * shared by the database, the admin, the public pages and the artwork script
 * without any of them re-declaring it.
 *
 * THE FLYER RULE, stated once and enforced everywhere below:
 * `flyerAssetId` holds the restaurant's OFFICIAL event flyer — the artwork the
 * event was actually promoted with. Website key art is a DIFFERENT slot and is
 * secondary. Nothing in this system may write the flyer slot except an admin
 * deliberately changing the flyer. See docs/events-system.md.
 */

/* ----------------------------------------------------------------- category */

export const EVENT_CATEGORIES = ['nightlife', 'vinyl-vermouth', 'brunch', 'comedy', 'special'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  nightlife: 'Nightlife',
  'vinyl-vermouth': 'Vinyl & Vermouth',
  brunch: 'Brunch',
  comedy: 'Comedy',
  special: 'Special event',
};

/** The filter chips on /events, in order. `all` is added by the page. */
export const CATEGORY_FILTERS: EventCategory[] = ['vinyl-vermouth', 'brunch', 'nightlife', 'comedy', 'special'];

export function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === 'string' && (EVENT_CATEGORIES as readonly string[]).includes(value);
}

/* ---------------------------------------------------------------- treatment */

/**
 * How prominently the homepage carries this event.
 *
 *   standard — appears in the list, nothing more
 *   featured — eligible for the homepage featured module
 *   takeover — may additionally influence the hero, inside its scheduled window
 */
export const EVENT_TREATMENTS = ['standard', 'featured', 'takeover'] as const;
export type EventTreatment = (typeof EVENT_TREATMENTS)[number];

/**
 * What each setting actually does, in the admin's own words.
 *
 * `featured` no longer reorders anything: the homepage and the events page both
 * run in date order, because a row of events that is not in time order reads as
 * broken. It goes first only among events starting at the same moment. Putting
 * an event ABOVE the calendar is what a hero takeover is for.
 */
export const TREATMENT_LABEL: Record<EventTreatment, { name: string; hint: string }> = {
  standard: { name: 'Standard', hint: 'Listed on the events page like everything else.' },
  featured: {
    name: 'Featured',
    hint: 'Goes first when two events start at the same time. Events are always listed in date order.',
  },
  takeover: {
    name: 'Hero takeover',
    hint: 'Takes over the homepage hero for the dates you set, then puts itself back.',
  },
};

export function isEventTreatment(value: unknown): value is EventTreatment {
  return typeof value === 'string' && (EVENT_TREATMENTS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------ visual preset */

/**
 * An accent style for an event's card and detail page.
 *
 * Deliberately a short list of NAMED looks rather than a colour picker: the
 * admin chooses "Bone & blood" and the design system decides what that means, so
 * an event can never be styled into something unreadable. Each preset supplies
 * an accent, a deep surface and a glow, all of which sit on the seasonal record.
 */
export const VISUAL_PRESETS = [
  'brass',
  'bone',
  'blood',
  'candy',
  'neon',
  'midnight',
  'gold',
] as const;
export type VisualPreset = (typeof VISUAL_PRESETS)[number];

export interface PresetStyle {
  name: string;
  hint: string;
  /** Accent, for type and rules. Measured ≥ 7:1 on the preset's own surface. */
  accent: string;
  /** The card's deep field. */
  surface: string;
  /** Ambient light behind the art. */
  glow: string;
}

export const PRESET_STYLE: Record<VisualPreset, PresetStyle> = {
  brass: {
    name: 'Marigold',
    hint: 'The house look — candle amber on deep plum.',
    accent: '#f0b24a',
    surface: '#1b0b1a',
    glow: 'rgb(236 150 62 / 0.30)',
  },
  bone: {
    name: 'Bone',
    hint: 'Pale ivory and antique gold. Calm, editorial.',
    accent: '#efe0c2',
    surface: '#181320',
    glow: 'rgb(226 210 178 / 0.22)',
  },
  blood: {
    name: 'Blood',
    hint: 'Deep oxblood and ember. For the horror nights.',
    accent: '#f08a6e',
    surface: '#22090f',
    glow: 'rgb(190 46 40 / 0.34)',
  },
  candy: {
    name: 'Candy',
    hint: 'Warm rose and cream. Playful without going pastel.',
    accent: '#f7a8bd',
    surface: '#25101d',
    glow: 'rgb(240 130 165 / 0.28)',
  },
  neon: {
    name: 'Neon',
    hint: 'Electric cyan over near-black. Club nights.',
    accent: '#7fe3e0',
    surface: '#0b1620',
    glow: 'rgb(80 200 210 / 0.26)',
  },
  midnight: {
    name: 'Midnight',
    hint: 'Cool indigo and silver. Late, quiet, cinematic.',
    accent: '#b9c4ef',
    surface: '#0f1226',
    glow: 'rgb(120 140 220 / 0.24)',
  },
  gold: {
    name: 'Gold',
    hint: 'Antique gold on espresso. Concerts and headliners.',
    accent: '#e6c27a',
    surface: '#1b1408',
    glow: 'rgb(214 172 92 / 0.28)',
  },
};

export function isVisualPreset(value: unknown): value is VisualPreset {
  return typeof value === 'string' && (VISUAL_PRESETS as readonly string[]).includes(value);
}

export const DEFAULT_PRESET: VisualPreset = 'brass';

/* ------------------------------------------------------------------ artwork */

/**
 * The artwork slots an event carries.
 *
 * `flyer` is first and is the official one. The rest are website art: they
 * change how the site presents the event, never what the event was promoted as.
 */
export const EVENT_ART_SLOTS = ['flyer', 'keyArt', 'keyArtMobile', 'foreground'] as const;
export type EventArtSlot = (typeof EVENT_ART_SLOTS)[number];

export const ART_SLOT_SPEC: Record<
  EventArtSlot,
  { label: string; hint: string; official: boolean; ratio: string }
> = {
  flyer: {
    label: 'Official flyer',
    hint: 'The real flyer for this event, exactly as it was promoted. Always shown whole, never cropped.',
    official: true,
    ratio: '1:1',
  },
  keyArt: {
    label: 'Website key art',
    hint: 'Wide background art for the website only. Optional — the flyer is used when this is empty.',
    official: false,
    ratio: '16:9',
  },
  keyArtMobile: {
    label: 'Phone key art',
    hint: 'A taller crop for phones. Optional.',
    official: false,
    ratio: '4:5',
  },
  foreground: {
    label: 'Foreground layer',
    hint: 'A cut-out that sits in front and may lean past the edge of the card. Optional.',
    official: false,
    ratio: '1:1',
  },
};
