import type { Metadata, Viewport } from 'next';
import QRCode from 'qrcode';
import { EventArt, presetVars, type EventArtwork } from '@/components/events/EventArt';
import { getSiteSettings } from '@/content/resolve';
import type { ResolvedEvent } from '@/content/types';
import { getReadDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getUpcomingEvents, ineligibleReason, venueIsoDate } from '@/lib/events';
import { formatEventTime, formatMinutes, formatTimeRangeCompact } from '@/lib/format';
import { getOpenState, groupHours } from '@/lib/hours';
import { absoluteUrl } from '@/lib/site-url';
import { resolveManyEventArtwork } from '@/server/content/event-art';
import { getPublicEvents } from '@/server/content/events';
import { hubFromRow } from '@/server/content/link-hubs';
import { Signage, type SignageSlide } from './Signage';
import './display.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cosa Nostra — In the room',
  description: 'The bar screen: tonight, what is coming up, and where to scan.',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b0806', colorScheme: 'dark' };

/**
 * The screen over the bar.
 *
 * A TV or projector left on all night, so: full-bleed, dark, type sized to
 * the room rather than the device, and nothing that needs a hand on a mouse.
 * Four slides crossfade in turn — tonight, what is coming up, a code to scan,
 * and the house line with the hours. `?slides=tonight,qr` picks and orders
 * them; `?interval=15` sets the seconds each one holds.
 *
 * It lives outside the public site's route group on purpose, so none of the
 * site's header, footer or scroll machinery is on screen. Everything it shows
 * is already public.
 */

const SLIDE_NAMES = ['tonight', 'coming', 'qr', 'brand'] as const;
type SlideName = (typeof SLIDE_NAMES)[number];
const ALIASES: Record<string, SlideName> = { next: 'coming', upcoming: 'coming', 'coming-up': 'coming', scan: 'qr', hours: 'brand', house: 'brand' };

function parseSlides(raw: string | string[] | undefined): SlideName[] {
  const text = Array.isArray(raw) ? raw.join(',') : raw;
  if (!text) return [...SLIDE_NAMES];
  const picked = text
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .map((part) => ((SLIDE_NAMES as readonly string[]).includes(part) ? (part as SlideName) : ALIASES[part]))
    .filter((part): part is SlideName => Boolean(part));
  const unique = [...new Set(picked)];
  return unique.length > 0 ? unique : [...SLIDE_NAMES];
}

function parseInterval(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(value) || value <= 0) return 12;
  return Math.min(300, Math.max(4, Math.round(value)));
}

/** The link hub guests should land on from the bar: a live or event hub if one is up, else the events page. */
async function scanTarget(now: Date): Promise<string> {
  const db = getReadDb();
  if (db) {
    try {
      const stamp = now.getTime();
      const hubs = (await db.list<Row>('link_hubs'))
        .map(hubFromRow)
        .filter((hub) => hub.status === 'published' && hub.slug && (!hub.startAt || Date.parse(hub.startAt) <= stamp) && (!hub.endAt || Date.parse(hub.endAt) > stamp));
      const rank = (type: string) => {
        const index = ['live', 'event', 'instagram-bio'].indexOf(type);
        return index === -1 ? 9 : index;
      };
      const best = hubs.sort((a, b) => rank(a.hubType) - rank(b.hubType))[0];
      if (best) return absoluteUrl(`/go/${best.slug}`);
    } catch {
      // No hubs table, or no hubs: the events page is always there.
    }
  }
  return absoluteUrl('/events');
}

export default async function DisplayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const wanted = parseSlides(params.slides);
  const interval = parseInterval(params.interval);
  const now = new Date();

  const [settings, input, target] = await Promise.all([getSiteSettings(), getPublicEvents(), scanTarget(now)]);
  const timeZone = settings.timeZone || 'America/Chicago';
  const events = getUpcomingEvents(input, now).filter((event) => ineligibleReason(event, now) === null);
  const today = venueIsoDate(now.toISOString());
  const tonight = events.filter((event) => venueIsoDate(event.startsAt) === today);
  const feature = tonight[0] ?? events[0] ?? null;
  const coming = events.filter((event) => event !== feature && !tonight.includes(event)).slice(0, 4);
  const artwork = await resolveManyEventArtwork([...(feature ? [feature] : []), ...coming]);

  const qrSvg = wanted.includes('qr')
    ? await QRCode.toString(target, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b0806', light: '#00000000' } })
    : '';

  const openState = getOpenState(settings.hours.value, settings.temporaryClosures, now, timeZone);
  const hours = groupHours(settings.hours.value);
  const todayHours = settings.hours.value.find((day) => day.day === new Date(`${today}T12:00:00Z`).getUTCDay());
  const tonightLine =
    settings.temporaryClosures.some((closure) => closure.date === today) || !todayHours || todayHours.closed || todayHours.ranges.length === 0
      ? 'Closed tonight'
      : `Tonight ${todayHours.ranges.map((range) => `${formatMinutes(range.openMinutes)} – ${formatMinutes(range.closeMinutes)}`).join(', ')}`;

  const slides: SignageSlide[] = [];
  for (const name of wanted) {
    if (name === 'tonight' && feature) {
      slides.push({ id: 'tonight', label: tonight.includes(feature) ? 'Tonight' : 'Next', node: <FeatureSlide event={feature} art={artwork.get(feature.id)!} isTonight={tonight.includes(feature)} also={tonight.slice(1)} /> });
    }
    if (name === 'coming' && coming.length > 0) {
      slides.push({ id: 'coming', label: 'Coming up', node: <ComingSlide events={coming} artwork={artwork} /> });
    }
    if (name === 'qr') {
      slides.push({ id: 'qr', label: 'Scan', node: <ScanSlide svg={qrSvg} target={target} /> });
    }
    if (name === 'brand') {
      slides.push({ id: 'brand', label: 'Hours', node: <BrandSlide hours={hours} tonightLine={tonightLine} openLabel={openState.open ? openState.label : null} address={`${settings.street} · ${settings.locality}`} /> });
    }
  }
  // Nothing on the calendar and nothing else asked for: the house line always has something to say.
  if (slides.length === 0) {
    slides.push({ id: 'brand', label: 'Hours', node: <BrandSlide hours={hours} tonightLine={tonightLine} openLabel={openState.open ? openState.label : null} address={`${settings.street} · ${settings.locality}`} /> });
  }

  return <Signage slides={slides} interval={interval} timeZone={timeZone} venue={settings.name} />;
}

/* ---------------------------------------------------------------- slides -- */

function dateParts(iso: string) {
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', ...options }).format(new Date(iso));
  return { weekday: format({ weekday: 'long' }), short: format({ weekday: 'short' }), day: format({ day: 'numeric' }), month: format({ month: 'short' }), monthLong: format({ month: 'long' }) };
}

function FeatureSlide({ event, art, isTonight, also }: { event: ResolvedEvent; art: EventArtwork; isTonight: boolean; also: ResolvedEvent[] }) {
  const when = dateParts(event.startsAt);
  const ambient = art.keyArt?.path ?? art.flyer?.path ?? null;
  const price = event.presentation.priceText ?? (event.priceCents === 0 ? 'Free' : null);
  return (
    <div className="cnd-slide-inner cnd-feature" style={presetVars(event.presentation.visualPreset)}>
      {ambient ? (
        // Decorative: the night's own art, blurred past legibility, as light in the room.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cnd-ambient" src={ambient} alt="" aria-hidden="true" />
      ) : null}
      <div className="cnd-feature-copy">
        <p className="cn-eyebrow cnd-eyebrow cnd-rise">{isTonight ? 'Tonight at Cosa Nostra' : `Next at Cosa Nostra · ${when.weekday}`}</p>
        <h1 className="cn-display cnd-feature-title cnd-rise" data-long={event.title.length > 26 ? 'true' : undefined}>
          {event.title}
        </h1>
        <p className="cnd-feature-when cn-num cnd-rise">
          {isTonight ? '' : `${when.weekday}, ${when.monthLong} ${when.day} · `}
          {formatTimeRangeCompact(event.startsAt, event.endsAt)}
          {price ? <span className="cnd-dot"> · {price}</span> : null}
        </p>
        {event.summary ? <p className="cnd-feature-summary cnd-rise">{event.summary}</p> : null}
        {also.length > 0 ? (
          <p className="cnd-also">
            Also tonight: {also.map((other) => `${other.title}, ${formatEventTime(other.startsAt)}`).join(' · ')}
          </p>
        ) : null}
      </div>
      <div className="cnd-feature-art">
        <EventArt art={art} title={event.title} preset={event.presentation.visualPreset} size="lead" fill priority sizes="45vw" uprightMedia="(max-aspect-ratio: 1/1)" />
      </div>
    </div>
  );
}

function ComingSlide({ events, artwork }: { events: ResolvedEvent[]; artwork: Map<string, EventArtwork> }) {
  return (
    <div className="cnd-slide-inner cnd-coming">
      <header className="cnd-coming-head">
        <p className="cn-eyebrow cnd-eyebrow cnd-rise">On the calendar</p>
        <h1 className="cn-display cnd-coming-title cnd-rise">
          Coming <em>up</em>
        </h1>
      </header>
      <ol className="cnd-coming-list" data-count={events.length}>
        {events.map((event) => {
          const when = dateParts(event.startsAt);
          return (
            <li key={event.id} className="cnd-coming-card" style={presetVars(event.presentation.visualPreset)}>
              <div className="cnd-coming-art">
                <EventArt art={artwork.get(event.id)!} title={event.title} preset={event.presentation.visualPreset} size="card" fill sizes="22vw" />
              </div>
              <p className="cnd-coming-date cn-num">
                <span>{when.short}</span>
                <strong>{when.day}</strong>
                <span>{when.month}</span>
              </p>
              <h2 className="cnd-coming-name">{event.title}</h2>
              <p className="cnd-coming-time cn-num">
                {formatEventTime(event.startsAt).replace(':00', '')}
                {/* The first clause only: "Free entry · No tickets needed" reads as "Free entry" on a card. */}
                {event.presentation.priceText ? ` · ${event.presentation.priceText.split('·')[0]!.trim()}` : ''}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ScanSlide({ svg, target }: { svg: string; target: string }) {
  const shown = target.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
    <div className="cnd-slide-inner cnd-scan">
      <div className="cnd-scan-copy">
        <p className="cn-eyebrow cnd-eyebrow cnd-rise">Phones out, just this once</p>
        <h1 className="cn-display cnd-scan-title cnd-rise">
          Scan for tonight’s <em>menu</em> &amp; events
        </h1>
        <p className="cnd-scan-sub cnd-rise">Point your camera at the code. The menu, what’s on, and tickets for the nights ahead.</p>
        <p className="cnd-scan-url cn-num cnd-rise">{shown}</p>
      </div>
      <figure className="cnd-qr" aria-label={`QR code linking to ${shown}`}>
        <div className="cnd-qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption>Cosa Nostra</figcaption>
      </figure>
    </div>
  );
}

function BrandSlide({
  hours,
  tonightLine,
  openLabel,
  address,
}: {
  hours: ReturnType<typeof groupHours>;
  tonightLine: string;
  openLabel: string | null;
  address: string;
}) {
  return (
    <div className="cnd-slide-inner cnd-brand">
      <p className="cn-eyebrow cnd-eyebrow cnd-rise">Cosa Nostra · Italian supper club</p>
      <h1 className="cn-display cnd-brand-line cnd-rise">
        Stay for dinner.
        <br />
        <em>Leave much later.</em>
      </h1>
      <p className="cnd-brand-tonight cn-num cnd-rise">{openLabel ? `${openLabel}` : tonightLine}</p>
      <dl className="cnd-hours cn-num">
        {hours.map((group) => (
          <div key={group.label}>
            <dt>{group.label}</dt>
            <dd>{group.value}</dd>
          </div>
        ))}
      </dl>
      <p className="cnd-brand-address">{address}</p>
    </div>
  );
}
