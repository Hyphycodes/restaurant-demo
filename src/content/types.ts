/**
 * Content model types. These mirror the Supabase schema in supabase/migrations/
 * one-for-one — see docs/CONTENT-MODEL.md.
 *
 * The static modules in this directory are both the zero-config fallback for the
 * public site AND the source used to generate supabase/seed.sql.
 */

import type { EventCategory, EventTreatment, VisualPreset } from './event-presentation';

export type Provisional<T> = {
  value: T;
  /** True when the value is disputed or unconfirmed. See docs/CONTENT-QUESTIONS.md. */
  provisional: boolean;
  /** Which section of CONTENT-QUESTIONS.md documents the open question. */
  note?: string;
};

/* -------------------------------------------------------------------------- */
/* Site settings                                                              */
/* -------------------------------------------------------------------------- */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface HoursRange {
  /** Minutes from midnight, local venue time. */
  openMinutes: number;
  /** Minutes from midnight. May exceed 1440 for past-midnight closing. */
  closeMinutes: number;
}

export interface DayHours {
  day: Weekday;
  ranges: HoursRange[];
  closed?: boolean;
}

export interface TemporaryClosure {
  id: string;
  /** ISO date, venue-local. */
  date: string;
  reason: string;
  allDay: boolean;
}

export interface SocialAccount {
  platform: 'facebook' | 'instagram' | 'tiktok' | 'youtube';
  handle: string;
  url: string;
}

export interface SiteSettings {
  name: string;
  shortName: string;
  tagline: string;
  street: string;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
  /** Coordinates are only used for the static map treatment and JSON-LD. */
  geo: { lat: number; lng: number } | null;
  phone: Provisional<string>;
  /** Second number found on Demo ordering. Not published; recorded so it is not lost. */
  altPhone: Provisional<string> | null;
  email: string | null;
  timeZone: string;
  hours: Provisional<DayHours[]>;
  temporaryClosures: TemporaryClosure[];
  reservationUrl: string;
  orderUrl: string;
  cateringOrderUrl: string;
  directionsUrl: string;
  socials: SocialAccount[];
  priceRange: string;
  cuisine: string[];
}

/* -------------------------------------------------------------------------- */
/* Announcement                                                               */
/* -------------------------------------------------------------------------- */

export interface Announcement {
  id: string;
  message: string;
  href: string | null;
  linkLabel: string | null;
  /** ISO datetime, or null for "no start bound". */
  startsAt: string | null;
  endsAt: string | null;
  enabled: boolean;
  tone: 'default' | 'night';
}

/* -------------------------------------------------------------------------- */
/* Menus                                                                      */
/* -------------------------------------------------------------------------- */

export type MenuSlug = 'food' | 'cocktails';

export type Dietary = 'vegetarian' | 'vegan' | 'gluten-free-option' | 'spicy';

export interface MenuModifier {
  label: string;
  /** null = the upcharge is not published. Renders as a plain choice, not "$0". */
  priceCents: number | null;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  /**
   * null means the base price is genuinely not published anywhere first-party.
   * It renders as `priceNote` ("Market price — ask your server"), never as $0
   * and never silently omitted. See docs/CONTENT-QUESTIONS.md §3.
   */
  priceCents: number | null;
  priceNote: string | null;
  modifierGroupLabel: string | null;
  modifiers: MenuModifier[];
  dietary: Dietary[];
  available: boolean;
  featured: boolean;
  /** Optional photograph of the dish (a media asset id). */
  imageAssetId?: string | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  note: string | null;
  items: MenuItem[];
}

export interface Menu {
  slug: MenuSlug;
  title: string;
  /** Rendered above the categories. */
  note: string | null;
  /** Shown when a menu has no categories yet. Never invented items. */
  emptyState: string | null;
  categories: MenuCategory[];
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

export type EventStatus = 'scheduled' | 'sold-out' | 'cancelled' | 'postponed' | 'free';

/**
 * How an event is presented, as opposed to what it is.
 *
 * Shared by series and occurrences so a recurring night and a one-off event are
 * dressed by exactly the same vocabulary. Every field is optional in the sense
 * that a null takes the default — an event with none of this set still renders.
 */
export interface EventPresentation {
  category: EventCategory | null;
  /** What entry costs, in words, when a number cannot say it. */
  priceText: string | null;
  /**
   * SECONDARY website art. Wide background used behind the event's own type.
   * When it is null the official flyer is shown instead — key art never
   * replaces the flyer, it only gives the website something wider to work with.
   */
  keyArtAssetId: string | null;
  /** A taller crop of the same idea, for phones. */
  keyArtMobileAssetId: string | null;
  /** Transparent cut-out allowed to lean past the edge of its own card. */
  foregroundAssetId: string | null;
  visualPreset: VisualPreset;
  featured: boolean;
  /** Tie-break inside a treatment. Higher wins. */
  priority: number;
  treatment: EventTreatment;
  /** Only meaningful for `treatment: 'takeover'`. ISO instants. */
  takeoverStartAt: string | null;
  takeoverEndAt: string | null;
}

/**
 * In-house ticketing settings for a standalone event.
 *
 * `enabled` is the switch. The rest describe how a price is presented and
 * what the guest agrees to; the tiers themselves live in `ticket_tiers` and
 * are read through `get_event_availability`, never stored on the event.
 */
export interface EventTicketing {
  enabled: boolean;
  capacity: number | null;
  agePolicy: 'all_ages' | '18+' | '21+' | null;
  refundPolicy: string | null;
  venueAddress: string | null;
  doorsOpenAt: string | null;
  feeDisplay: 'inclusive' | 'itemized';
  taxRateBps: number;
  serviceFeeBps: number;
  serviceFeeFlatCents: number;
}

export const DEFAULT_TICKETING: EventTicketing = {
  enabled: false,
  capacity: null,
  agePolicy: null,
  refundPolicy: null,
  venueAddress: null,
  doorsOpenAt: null,
  feeDisplay: 'inclusive',
  taxRateBps: 0,
  serviceFeeBps: 0,
  serviceFeeFlatCents: 0,
};

/** The sentences the event editor collects, and the flyer's own colour. */
export interface EventDetails {
  /** Sanitised HTML with bold, italic, links and lists. Null = use `description` as text. */
  descriptionHtml: string | null;
  includedText: string | null;
  bringText: string | null;
  arrivalText: string | null;
  /** Dominant colour of the flyer, `#rrggbb`, extracted on upload. */
  accentHint: string | null;
}

export const DEFAULT_DETAILS: EventDetails = {
  descriptionHtml: null,
  includedText: null,
  bringText: null,
  arrivalText: null,
  accentHint: null,
};


export interface EventProvenance {
  source: 'manual' | 'tickeri';
  sourceEventId: string | null;
  sourceUrl: string | null;
  syncedAt: string | null;
}

/** `weekly:5` = every Friday. Weekday uses the same 0=Sunday indexing as Date. */
export type Cadence = { kind: 'weekly'; weekday: Weekday } | { kind: 'one-time' };

/**
 * A series carries NO date. That is the entire point: a recurring series cannot
 * render a stale date because it has no date to render. Dates live only on
 * occurrences and are composited over artwork as live HTML.
 * See PLAN.md §4.1.
 */
export interface EventSeries {
  slug: string;
  title: string;
  summary: string;
  description: string;
  cadence: Cadence;
  /** Minutes from midnight, venue-local. */
  startMinutes: number;
  /** Minutes from midnight; > 1440 means it ends after midnight. */
  endMinutes: number;
  ageMin: number | null;
  ageNote: string | null;
  musicFormats: string[];
  venueName: string;
  /**
   * UNDATED series artwork. Anything tagged `containsText: 'date'` is rejected
   * here by both the content test and the asset checker.
   */
  artworkAssetId: string | null;
  /**
   * The restaurant's own flyer for the series. These DO carry a printed date, so
   * this slot is deliberately separate from `artworkAssetId` and is only legal
   * alongside `flyerPrintedDate`.
   */
  flyerAssetId: string | null;
  /**
   * The date printed on `flyerAssetId`, in the venue's own wording ("August 8th").
   * Required whenever the flyer image is tagged `containsText: 'date'`, so the UI
   * can caption the artwork and the printed date can never be read as the next
   * date. null only when the flyer genuinely carries no date.
   */
  flyerPrintedDate: string | null;
  ticketUrl: string | null;
  priceCents: number | null;
  status: EventStatus;
  /** Generated occurrences stop here. null = open-ended. */
  seriesEndsOn: string | null;
  /** Paused stops generation without losing the series or its history. */
  paused?: boolean;
  archivedAt?: string | null;
  /** What the guest is expected to do about entry. */
  ticketPolicy?: 'required' | 'door' | 'free' | 'later';
  presentation?: EventPresentation;
}

/**
 * One night, with every inherited value already resolved.
 *
 * `overriddenFields` records which values came from the occurrence rather than
 * the series — the admin needs it to label inherited values, and to offer "use
 * the series default" for exactly the fields that have been changed.
 */
export interface ResolvedEvent {
  id: string;
  /** The `event_occurrences` row backing this night, when one exists. */
  overrideId: string | null;
  seriesSlug: string | null;
  series: EventSeries | null;
  slug: string | null;
  /** ISO datetime with venue offset. */
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  published: boolean;
  archivedAt: string | null;
  ticketUrl: string | null;
  ticketLabel: string | null;
  priceCents: number | null;
  title: string;
  summary: string;
  description: string;
  ageMin: number | null;
  ageNote: string | null;
  musicFormats: string[];
  venueName: string;
  /**
   * The OFFICIAL flyer. This is the artwork the event was promoted with and the
   * website always has a way to show it; nothing else in the model may write it.
   */
  flyerAssetId: string | null;
  /** Only set when the flyer is the series' own dated artwork. */
  flyerPrintedDate: string | null;
  note: string | null;
  overriddenFields: string[];
  presentation: EventPresentation;
  provenance: EventProvenance;
  ticketing: EventTicketing;
  details: EventDetails;
}

/** The defaults an event takes when it has expressed no preference. */
export const DEFAULT_PRESENTATION: EventPresentation = {
  category: null,
  priceText: null,
  keyArtAssetId: null,
  keyArtMobileAssetId: null,
  foregroundAssetId: null,
  visualPreset: 'brass',
  featured: false,
  priority: 0,
  treatment: 'standard',
  takeoverStartAt: null,
  takeoverEndAt: null,
};

/**
 * A one-off event as the typed content declares it.
 *
 * Flatter than an `OccurrenceRecord` on purpose: the seed states a venue-local
 * DATE and start/end minutes rather than an instant, so the same declaration is
 * correct either side of a daylight-saving change and nobody has to hand-write
 * an offset.
 */
export interface OneTimeEventSeed {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  /** Venue-local ISO date. */
  date: string;
  startMinutes: number;
  endMinutes: number;
  category: EventCategory;
  visualPreset: VisualPreset;
  featured?: boolean;
  treatment?: EventTreatment;
  priority?: number;
  
  ticketUrl: string | null;
  
  sourceUrl: string;
  priceText?: string | null;
  ageMin?: number | null;
  ageNote?: string | null;
  status?: EventStatus;
  
  sourceEventId: string;
}

export const DEFAULT_PROVENANCE: EventProvenance = {
  source: 'manual',
  sourceEventId: null,
  sourceUrl: null,
  syncedAt: null,
};

/* -------------------------------------------------------------------------- */
/* Catering                                                                   */
/* -------------------------------------------------------------------------- */

export interface CateringPackage {
  id: string;
  name: string;
  servesMin: number | null;
  servesMax: number | null;
  priceCents: number;
  includes: string[];
}

export interface CateringItem {
  id: string;
  name: string;
  priceCents: number;
  note: string | null;
}

/* -------------------------------------------------------------------------- */
/* Page sections                                                              */
/* -------------------------------------------------------------------------- */

export interface PageSection {
  key: string;
  eyebrow: string | null;
  heading: string;
  body: string | null;
  visible: boolean;
  /** Approved layout variants. Editors choose from these; they cannot author CSS. */
  variant: 'editorial-left' | 'editorial-right' | 'stagger' | 'band' | 'plain';
}

export interface PageSeo {
  title: string;
  description: string;
  /** Asset ID for the social image, or null to use the site default. */
  ogAssetId: string | null;
}

/* -------------------------------------------------------------------------- */
/* Inquiries                                                                  */
/* -------------------------------------------------------------------------- */

export type InquiryType = 'catering' | 'private-event' | 'careers';

/**
 * Where an enquiry has got to. Five stages, left to right on the admin board.
 * Mirrors `public.inquiry_status` (migration 0027).
 */
export type InquiryStatus = 'new' | 'contacted' | 'planning' | 'booked' | 'closed';

/**
 * What may be found in a stored row: the five stages, plus 'in-progress' from
 * before 0027, which renders as 'contacted'. See `normalizeInquiryStatus`.
 */
export type StoredInquiryStatus = InquiryStatus | 'in-progress';

export interface InquiryRecord {
  id: string;
  /** Human-quotable, e.g. EVT-260923-4KQ2. Empty for very old rows. */
  reference: string;
  type: InquiryType;
  name: string;
  email: string;
  phone: string | null;
  payload: Record<string, string | number | boolean | null>;
  /** Always one of the five stages; legacy values are normalised on read. */
  status: InquiryStatus;
  notes: string | null;
  /** One line: what happens next. Staff-only. */
  nextStep: string | null;
  /** Venue-local YYYY-MM-DD, or null. */
  followUpOn: string | null;
  /** When it last moved stage; falls back to createdAt for rows without one. */
  statusChangedAt: string;
  createdAt: string;
}
