import 'server-only';
import { DEMO_MODE } from '@/lib/demo';



export const TICKERI_ORG_URL = 'https://example.invalid/demo';


export interface TickeriEvent {
  
  sourceEventId: string;
  url: string;
  title: string;
  /** ISO instant. */
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  description: string | null;
  
  flyerUrl: string | null;
  priceText: string | null;
  soldOut: boolean;
  cancelled: boolean;
}

export interface TickeriReadResult {
  events: TickeriEvent[];
  /** Pages that could not be read, with the reason. Surfaced to the admin. */
  problems: string[];
}

/* ------------------------------------------------------------------- parse */

/** Every `<script type="application/ld+json">` payload on a page, parsed. */
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // A single malformed block must not lose the ones that parsed.
    }
  }
  return out;
}

/** Walks a JSON-LD payload and yields every node that looks like an Event. */
function* eventNodes(node: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(node)) {
    for (const entry of node) yield* eventNodes(entry);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;

  const type = record['@type'];
  const types = Array.isArray(type) ? type.map(String) : [String(type ?? '')];
  if (types.some((t) => t.endsWith('Event'))) yield record;

  // @graph, itemListElement, subEvent — containers that hold the real nodes.
  for (const key of ['@graph', 'itemListElement', 'subEvent', 'item', 'events']) {
    if (key in record) yield* eventNodes(record[key]);
  }
}


export function tickeriEventId(url: string): string | null {
  const match = /\/events\/([a-z0-9]+)(?:\/|$|\?)/i.exec(url);
  return match?.[1] ?? null;
}

function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

function firstUrl(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) return firstUrl(value[0]);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return firstUrl(record.url ?? record.contentUrl ?? record['@id']);
  }
  return null;
}

function venueOf(node: Record<string, unknown>): string | null {
  const location = node.location;
  if (!location) return null;
  if (typeof location === 'string') return location.trim() || null;
  if (Array.isArray(location)) return venueOf({ location: location[0] });
  return text((location as Record<string, unknown>).name);
}


function priceOf(node: Record<string, unknown>): { priceText: string | null; soldOut: boolean } {
  const raw = node.offers;
  const offers = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Record<string, unknown>[];
  if (offers.length === 0) return { priceText: null, soldOut: false };

  const availability = offers
    .map((offer) => String(offer.availability ?? ''))
    .filter(Boolean);
  const soldOut =
    availability.length > 0 && availability.every((value) => /SoldOut|OutOfStock/i.test(value));

  const amounts = offers
    .map((offer) => Number(offer.price ?? (offer.priceSpecification as Record<string, unknown>)?.price))
    .filter((value) => Number.isFinite(value) && value >= 0);

  if (amounts.length === 0) return { priceText: null, soldOut };
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  const money = (value: number) =>
    value === 0 ? 'Free' : `$${Number.isInteger(value) ? value : value.toFixed(2)}`;

  return { priceText: low === high ? money(low) : `${money(low)}–${money(high)}`, soldOut };
}

/** One JSON-LD Event node → our shape, or null when it is not usable. */
export function eventFromJsonLd(node: Record<string, unknown>, fallbackUrl?: string): TickeriEvent | null {
  const url = firstUrl(node.url ?? node['@id']) ?? fallbackUrl ?? null;
  const title = text(node.name);
  const start = text(node.startDate);
  if (!url || !title || !start) return null;

  const startsAt = new Date(start);
  if (Number.isNaN(startsAt.getTime())) return null;

  const sourceEventId = tickeriEventId(url);
  if (!sourceEventId) return null;

  const end = text(node.endDate);
  const endsAt = end && !Number.isNaN(new Date(end).getTime()) ? new Date(end).toISOString() : null;
  const { priceText, soldOut } = priceOf(node);
  const status = String(node.eventStatus ?? '');

  return {
    sourceEventId,
    url,
    title,
    startsAt: startsAt.toISOString(),
    endsAt,
    venueName: venueOf(node),
    description: text(node.description),
    flyerUrl: firstUrl(node.image),
    priceText,
    soldOut,
    cancelled: /Cancelled|Postponed/i.test(status),
  };
}


export function parseEvents(html: string, pageUrl?: string): TickeriEvent[] {
  const found = new Map<string, TickeriEvent>();
  for (const payload of extractJsonLd(html)) {
    for (const node of eventNodes(payload)) {
      const event = eventFromJsonLd(node, pageUrl);
      if (event) found.set(event.sourceEventId, event);
    }
  }
  return [...found.values()];
}

/**
 * Links to individual event pages, for when the organizer page lists events as
 * markup rather than as JSON-LD. Each one is then read on its own.
 */
export function parseEventLinks(html: string, limit = 60): string[] {
  const links = new Set<string>();
  // The query string is captured and discarded: a tracking parameter must not
  // make the same event look like a second one.
  const pattern = /href=["'](\/events\/[a-z0-9]+\/[^"'?#\s]*)[^"']*["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null && links.size < limit) {
    links.add(`https://www.tickeri.com${match[1]}`);
  }
  return [...links];
}

/* ------------------------------------------------------------------- fetch */

const FETCH_TIMEOUT_MS = 12_000;

async function getHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // Identifying ourselves is the polite half of scraping someone's page
      // once, by hand, to reconcile events we are already selling for them.
      headers: {
        'user-agent': 'CasaAureliaBot/1.0 (+https://example.invalid/demo)',
        accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read the organizer page, and each event page it links to.
 *
 * Sequential with a small delay rather than a burst of parallel requests: this
 * runs at most a few times a month, from one person pressing a button, and
 * being a good citizen of someone else's server costs us nothing.
 */
export async function readTickeriCalendar(orgUrl = TICKERI_ORG_URL): Promise<TickeriReadResult> {
  if (DEMO_MODE) return {events:[], problems:["External event imports are disabled in Demo Workspace."]};
  const problems: string[] = [];
  let indexHtml: string;

  try {
    indexHtml = await getHtml(orgUrl);
  } catch (error) {
    return {
      events: [],
      problems: [
        `Could not open the Tickeri events page (${error instanceof Error ? error.message : 'unknown error'}). Nothing was changed.`,
      ],
    };
  }

  const found = new Map<string, TickeriEvent>();
  for (const event of parseEvents(indexHtml, orgUrl)) found.set(event.sourceEventId, event);

  // The listing usually carries only names and links; the detail pages carry the
  // structured data. Fetch the ones we do not already have in full.
  const links = parseEventLinks(indexHtml);
  for (const link of links) {
    const id = tickeriEventId(link);
    if (!id) continue;
    const known = found.get(id);
    if (known?.startsAt && known.flyerUrl) continue;

    try {
      const html = await getHtml(link);
      const [event] = parseEvents(html, link);
      if (event) found.set(event.sourceEventId, event);
      else problems.push(`No event details were readable on ${link}`);
    } catch (error) {
      problems.push(`Could not open ${link} (${error instanceof Error ? error.message : 'unknown error'})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (found.size === 0 && problems.length === 0) {
    problems.push('The Tickeri page opened but listed no events we could read.');
  }

  return {
    events: [...found.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    problems,
  };
}
