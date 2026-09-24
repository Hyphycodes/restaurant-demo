import {
  DEFAULT_PRESENTATION,
  DEFAULT_PROVENANCE,
  DEFAULT_DETAILS,
  DEFAULT_TICKETING,
  type EventDetails,
  type EventPresentation,
  type EventTicketing,
  type EventProvenance,
  type EventSeries,
  type EventStatus,
  type OneTimeEventSeed,
  type ResolvedEvent,
} from '@/content/types';

/**
 * Occurrence generation and the next-event selector.
 *
 * Two rules hold this together:
 *
 * 1. A SERIES HAS NO DATE. Recurring dates are generated from `cadence` at read
 *    time, so a weekly series has no stored date that can go stale and no artwork
 *    that can become the authoritative one. See PLAN.md §4.1.
 *
 * 2. AN OVERRIDE IS SPARSE. A single night gets its own row only when something
 *    about it actually differs — its own flyer, its own ticket link, a
 *    cancellation. Everything else is inherited, and the admin shows which is
 *    which.
 *
 * A one-time event is an occurrence with no series, so the selector has one code
 * path rather than two.
 *
 * IN-PROGRESS EVENTS STAY "NEXT" UNTIL THEY END. Friday's night is still the
 * answer to "what's on" at 1am on Saturday — which is exactly when somebody is
 * checking their phone. The rule is applied identically on the homepage and on
 * /events; `events.test.ts` pins it, along with the August 15 / August 14 case
 * from the live-site audit.
 */

const DEFAULT_WEEKS = 26;
const TZ = 'America/Chicago';

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

/** A per-night override, or a standalone one-time event when `seriesSlug` is null. */
export interface OccurrenceRecord {
  id: string;
  seriesSlug: string | null;
  /** Venue-local ISO date (`2026-08-21`) for an override; full ISO for standalone. */
  startsAt: string;
  endsAt?: string | null;
  status?: EventStatus | null;
  published?: boolean;
  archivedAt?: string | null;
  ticketUrl?: string | null;
  ticketLabel?: string | null;
  priceCents?: number | null;
  title?: string | null;
  slug?: string | null;
  summary?: string | null;
  description?: string | null;
  ageMin?: number | null;
  ageNote?: string | null;
  musicFormats?: string[] | null;
  venueName?: string | null;
  flyerAssetId?: string | null;
  note?: string | null;
  /** Sparse presentation override. A null field inherits from the series. */
  presentation?: Partial<EventPresentation> | null;
  provenance?: EventProvenance | null;
  ticketing?: EventTicketing | null;
  details?: EventDetails | null;
}

export interface EventInput {
  series: EventSeries[];
  occurrences: OccurrenceRecord[];
  weeks?: number;
}

/* -------------------------------------------------------------------------- */
/* Venue-local time                                                           */
/* -------------------------------------------------------------------------- */

/**
 * An ISO instant for a venue-local wall-clock time on a given date.
 * The offset is resolved for that specific date, so a CST/CDT transition cannot
 * shift a 10pm door time to 9pm or 11pm.
 */
export function venueLocalIso(year: number, month: number, day: number, minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMinutes = tzOffsetMinutes(new Date(naive));
  const corrected = new Date(naive - offsetMinutes * 60_000);

  // Re-resolve once: the correction can itself cross a DST boundary.
  const settled = new Date(naive - tzOffsetMinutes(corrected) * 60_000);
  return settled.toISOString();
}

function tzOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    timeZoneName: 'shortOffset',
  }).formatToParts(date);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-6';
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return -360;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

export function venueDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
    isoDate: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

/** The venue-local calendar date an instant falls on. */
export function venueIsoDate(iso: string): string {
  return venueDateParts(new Date(iso)).isoDate;
}


export function ticketUrlForOccurrence(seriesSlug: string, startsAt: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(startsAt));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';
  // Intl renders midnight as "24" in some engines; the slug needs "00".
  const hour = get('hour') === '24' ? '00' : get('hour');

  const stamp = `${get('year')}-${get('month')}-${get('day')}-${hour}-${get('minute')}`;
  return `/events/${seriesSlug}?date=${stamp}`;
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Fields an occurrence may override, in the order the admin lists them.
 * Exported so the admin cannot drift out of step with what is actually
 * overridable.
 */
export const OVERRIDABLE = [
  'startsAt',
  'endsAt',
  'status',
  'ticketUrl',
  'priceCents',
  'title',
  'summary',
  'description',
  'ageMin',
  'ageNote',
  'musicFormats',
  'venueName',
  'flyerAssetId',
] as const;

function resolve(
  series: EventSeries | null,
  occurrence: OccurrenceRecord | null,
  startsAt: string,
  endsAt: string,
): ResolvedEvent {
  const overridden: string[] = [];
  const take = <T>(field: (typeof OVERRIDABLE)[number], override: T | null | undefined, base: T): T => {
    if (override === null || override === undefined) return base;
    if (Array.isArray(override) && Array.isArray(base) && override.join() === base.join()) {
      return base;
    }
    if (override === base) return base;
    overridden.push(field);
    return override;
  };

  const seriesSlug = series?.slug ?? null;
  const resolvedStart = occurrence?.seriesSlug ? take('startsAt', occurrence.startsAt && occurrence.startsAt.length > 10 ? occurrence.startsAt : null, startsAt) : startsAt;
  const resolvedEnd = occurrence?.seriesSlug ? take('endsAt', occurrence.endsAt && occurrence.endsAt.length > 10 ? occurrence.endsAt : null, endsAt) : endsAt;

  const status = take('status', occurrence?.status ?? null, series?.status ?? 'scheduled');
  const freeEntry = series?.ticketPolicy === 'free';
  const priceCents = freeEntry ? 0 : take(
    'priceCents',
    occurrence?.priceCents === undefined ? null : occurrence.priceCents,
    series?.priceCents ?? null,
  );

  const ticketUrl = freeEntry ? null : take(
    'ticketUrl',
    occurrence?.ticketUrl ?? null,
    series
      ? (series.ticketPolicy && series.ticketPolicy !== 'required' ? null : series.ticketUrl ?? ticketUrlForOccurrence(series.slug, resolvedStart))
      : null,
  );

  return {
    id: occurrence && !seriesSlug ? `one-time:${occurrence.id}` : `${seriesSlug}:${venueIsoDate(resolvedStart)}`,
    overrideId: occurrence?.id ?? null,
    seriesSlug,
    series,
    slug: occurrence?.slug ?? series?.slug ?? null,
    startsAt: resolvedStart,
    endsAt: resolvedEnd,
    status,
    published: occurrence?.published ?? true,
    archivedAt: occurrence?.archivedAt ?? null,
    ticketUrl,
    ticketLabel: occurrence?.ticketLabel ?? null,
    priceCents,
    title: take('title', occurrence?.title ?? null, series?.title ?? 'Event'),
    summary: take('summary', occurrence?.summary ?? null, series?.summary ?? ''),
    description: take('description', occurrence?.description ?? null, series?.description ?? ''),
    ageMin: take('ageMin', occurrence?.ageMin ?? null, series?.ageMin ?? null),
    ageNote: take('ageNote', occurrence?.ageNote ?? null, series?.ageNote ?? null),
    musicFormats: take('musicFormats', occurrence?.musicFormats ?? null, series?.musicFormats ?? []),
    venueName: take(
      'venueName',
      occurrence?.venueName ?? null,
      series?.venueName ?? 'Casa Aurelia',
    ),
    flyerAssetId: take('flyerAssetId', occurrence?.flyerAssetId ?? null, series?.flyerAssetId ?? null),
    flyerPrintedDate: occurrence?.flyerAssetId ? null : (series?.flyerPrintedDate ?? null),
    note: occurrence?.note ?? null,
    overriddenFields: overridden,
    // Presentation resolves field by field, occurrence over series over the
    // defaults, so featuring ONE night of a weekly series does not require
    // restating everything else that night inherits.
    presentation: { ...mergePresentation(series?.presentation, occurrence?.presentation), ...(freeEntry ? { priceText: 'Free entry · No tickets needed' } : {}) },
    provenance: occurrence?.provenance ?? DEFAULT_PROVENANCE,
    // Only a standalone event can sell tickets here; a series night inherits
    // nothing, because weekly nights are free at the door.
    ticketing: (!seriesSlug && occurrence?.ticketing) || DEFAULT_TICKETING,
    details: (!seriesSlug && occurrence?.details) || DEFAULT_DETAILS,
  };
}

/**
 * Occurrence over series over defaults, per field.
 *
 * `featured` and `treatment` deliberately do NOT fall back to the series when
 * the occurrence says 'standard': the whole point of featuring one night is
 * that the other nights of the same series are not featured. A series-level
 * feature still reaches every night, because the series value is the base.
 */
export function mergePresentation(
  series: EventPresentation | undefined,
  occurrence: Partial<EventPresentation> | null | undefined,
): EventPresentation {
  const base: EventPresentation = { ...DEFAULT_PRESENTATION, ...(series ?? {}) };
  if (!occurrence) return base;

  const merged = { ...base };
  for (const [key, value] of Object.entries(occurrence) as [
    keyof EventPresentation,
    EventPresentation[keyof EventPresentation],
  ][]) {
    if (value === null || value === undefined) continue;
    Object.assign(merged, { [key]: value });
  }
  return merged;
}

/**
 * Whether an event's hero takeover is running right now.
 *
 * Fails closed: a takeover with a missing or unparseable window is not running,
 * because a hero stuck on a finished event is the failure that matters.
 */
export function takeoverIsLive(event: ResolvedEvent, now: Date): boolean {
  const { treatment, takeoverStartAt, takeoverEndAt } = event.presentation;
  if (treatment !== 'takeover') return false;
  if (!takeoverStartAt || !takeoverEndAt) return false;
  const start = Date.parse(takeoverStartAt);
  const end = Date.parse(takeoverEndAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const at = now.getTime();
  return at >= start && at < end;
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                 */
/* -------------------------------------------------------------------------- */

export function generateOccurrences(
  series: EventSeries,
  from: Date,
  occurrences: OccurrenceRecord[] = [],
  weeks = DEFAULT_WEEKS,
): ResolvedEvent[] {
  if (series.cadence.kind !== 'weekly') return [];
  if (series.paused) return [];

  const byDate = new Map<string, OccurrenceRecord>();
  for (const record of occurrences) {
    if (record.seriesSlug !== series.slug) continue;
    // Date-only overrides are venue dates; instants must be converted from UTC.
    const date = record.startsAt.length === 10 ? record.startsAt : venueIsoDate(record.startsAt);
    byDate.set(date, record);
  }

  const results: ResolvedEvent[] = [];
  const target = series.cadence.weekday;
  const cursor = new Date(from.getTime());

  // Step back to the start of the current venue-local day, so an event happening
  // right now is still generated and can still count as upcoming until it ends.
  cursor.setUTCHours(cursor.getUTCHours() - 12);

  for (let i = 0; i < weeks * 7 + 7; i += 1) {
    const probe = new Date(cursor.getTime() + i * 86_400_000);
    const parts = venueDateParts(probe);
    if (parts.weekday !== target) continue;
    if (series.seriesEndsOn && parts.isoDate > series.seriesEndsOn) break;

    const startsAt = venueLocalIso(parts.year, parts.month, parts.day, series.startMinutes);
    const endsAt = venueLocalIso(parts.year, parts.month, parts.day, series.endMinutes);

    // A night must never end before it starts, whatever the data says.
    if (new Date(endsAt) <= new Date(startsAt)) continue;

    results.push(resolve(series, byDate.get(parts.isoDate) ?? null, startsAt, endsAt));
    if (results.length >= weeks) break;
  }

  return results;
}

/**
 * A typed one-off event declaration → the occurrence record the selector reads.
 *
 * The seed states a venue-local date and clock times; the instants are computed
 * here for that specific date, so an event either side of a daylight-saving
 * change keeps the door time the flyer printed.
 */
export function occurrenceFromSeed(seed: OneTimeEventSeed): OccurrenceRecord {
  const [year, month, day] = seed.date.split('-').map(Number);
  const startsAt = venueLocalIso(year!, month!, day!, seed.startMinutes);
  const endMinutes = seed.endMinutes <= seed.startMinutes ? seed.endMinutes + 1440 : seed.endMinutes;
  const endsAt = venueLocalIso(year!, month!, day!, endMinutes);

  return {
    id: seed.id,
    seriesSlug: null,
    startsAt,
    endsAt,
    status: seed.status ?? null,
    published: true,
    archivedAt: null,
    ticketUrl: seed.ticketUrl,
    ticketLabel: null,
    priceCents: null,
    title: seed.title,
    slug: seed.slug,
    summary: seed.summary,
    description: seed.description,
    ageMin: seed.ageMin ?? null,
    ageNote: seed.ageNote ?? null,
    musicFormats: null,
    venueName: null,
    // Null: an uploaded or imported flyer lives in the database, and a flyer
    // that ships in the repo is matched by slug (see event-art-defaults).
    flyerAssetId: null,
    note: null,
    presentation: {
      category: seed.category,
      priceText: seed.priceText ?? null,
      visualPreset: seed.visualPreset,
      featured: seed.featured ?? false,
      treatment: seed.treatment ?? 'standard',
      priority: seed.priority ?? 0,
    },
    provenance: {
      source: 'tickeri',
      sourceEventId: seed.sourceEventId,
      sourceUrl: seed.sourceUrl,
      syncedAt: null,
    },
  };
}

/** One-time events: occurrence rows with no series behind them. */
export function standaloneEvents(occurrences: OccurrenceRecord[]): ResolvedEvent[] {
  return occurrences
    .filter((record) => record.seriesSlug === null)
    .map((record) =>
      resolve(null, record, record.startsAt, record.endsAt ?? record.startsAt),
    );
}

/* -------------------------------------------------------------------------- */
/* Eligibility                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Why an occurrence is not eligible to be shown as upcoming, or null if it is.
 * Returning the reason rather than a boolean is what lets the admin's readiness
 * table say "no ticket link" instead of just hiding the row.
 */
export function ineligibleReason(event: ResolvedEvent, now: Date): string | null {
  if (!event.published) return 'Draft — not on the website yet';
  if (event.archivedAt) return 'Archived';
  if (event.series?.paused) return 'Series paused';
  if (event.series?.archivedAt) return 'Series archived';
  if (!Number.isFinite(Date.parse(event.startsAt)) || !Number.isFinite(Date.parse(event.endsAt)) || Date.parse(event.endsAt) <= Date.parse(event.startsAt)) return 'Invalid date or duration';
  if (new Date(event.endsAt).getTime() <= now.getTime()) return 'Already finished';
  if (event.status === 'cancelled') return 'Cancelled';
  if (event.status === 'postponed') return 'Postponed';
  if (!event.title.trim()) return 'No name';
  return null;
}

/**
 * Every eligible upcoming occurrence, soonest first.
 *
 * A cancelled night inside the next fortnight is kept so a guest holding a ticket
 * is told rather than left to find a dark room — but `nextEvent` never returns
 * one, because a cancellation is not something to advertise.
 */
export function getUpcomingEvents(input: EventInput, now: Date, limit?: number): ResolvedEvent[] {
  const generated = input.series.flatMap((series) =>
    generateOccurrences(series, now, input.occurrences, input.weeks ?? DEFAULT_WEEKS),
  );

  const all = [...generated, ...standaloneEvents(input.occurrences)]
    .filter((event) => {
      const reason = ineligibleReason(event, now);
      if (reason === null) return true;
      // The single exception, so ticket-holders are informed.
      return (reason === 'Cancelled' || reason === 'Postponed') && isSoon(event.startsAt, now);
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return typeof limit === 'number' ? all.slice(0, limit) : all;
}

/**
 * THE next occurrence to promote, or null.
 *
 * This is the one function the homepage and /events both use, so they can never
 * disagree. A past, cancelled, draft, archived or paused occurrence can never be
 * returned — `events.test.ts` asserts each of those individually, plus the exact
 * case the live-site audit found on August 15, 2026.
 */
export function nextEvent(
  input: EventInput,
  now: Date,
  seriesSlug?: string,
): ResolvedEvent | null {
  const candidates = getUpcomingEvents(input, now).filter(
    (event) => ineligibleReason(event, now) === null,
  );
  const scoped = seriesSlug
    ? candidates.filter((event) => event.seriesSlug === seriesSlug)
    : candidates;
  return scoped[0] ?? null;
}

/** The next occurrence of each series, in series order. */
export function nextPerSeries(input: EventInput, now: Date): ResolvedEvent[] {
  return input.series
    .map((series) => nextEvent(input, now, series.slug))
    .filter((event): event is ResolvedEvent => event !== null);
}

export function getSeriesOccurrences(
  input: EventInput,
  slug: string,
  now: Date,
  limit = 6,
): ResolvedEvent[] {
  return getUpcomingEvents(input, now)
    .filter((event) => event.seriesSlug === slug)
    .slice(0, limit);
}

/** Cancelled nights stay visible for two weeks so guests are not surprised. */
function isSoon(iso: string, now: Date): boolean {
  return new Date(iso).getTime() - now.getTime() < 14 * 86_400_000;
}

/** Human label for a status. Never conveyed by colour alone. */
export const STATUS_LABEL: Record<string, string> = {
  scheduled: '',
  'sold-out': 'Sold out',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
  free: 'Free entry',
};

/** Google Calendar link. Built from the occurrence's own timestamps. */
export function addToCalendarUrl(event: ResolvedEvent, address: string): string {
  const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.startsAt)}/${stamp(event.endsAt)}`,
    details: event.description,
    location: `${event.venueName}, ${address}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * A standalone event by slug, whatever its state.
 *
 * Deliberately not filtered through `getUpcomingEvents`: a cancelled event, and
 * one that finished an hour ago, must still resolve. Someone holding a ticket
 * arrives on its page to find out what happened, and a 404 is the worst
 * possible answer. Drafts and archived events stay unreachable.
 */
export function findStandaloneEvent(input: EventInput, slug: string): ResolvedEvent | null {
  return (
    standaloneEvents(input.occurrences).find(
      (event) => event.slug === slug && event.published && !event.archivedAt,
    ) ?? null
  );
}
