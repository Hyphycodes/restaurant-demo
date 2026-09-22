import Image from 'next/image';
import Link from 'next/link';
import { EventDecor } from '@/components/events/EventDecor';
import { EventTile } from '@/components/events/EventTile';
import { StickyBuyBar } from '@/components/events/StickyBuyBar';
import { TicketBox } from '@/components/events/TicketBox';
import { Band, Frame } from '@/components/primitives/Band';
import { ButtonLink, ExternalTextLink } from '@/components/primitives/Button';
import { CATEGORY_LABEL, PRESET_STYLE } from '@/content/event-presentation';
import type { PublicAsset } from '@/content/media';
import type { ResolvedEvent, SiteSettings } from '@/content/types';
import { addToCalendarUrl } from '@/lib/events';
import { formatEventDateCompact, formatTimeRangeCompact } from '@/lib/format';
import { isSoldOut, priceHeadline, type TicketOffer } from '@/lib/ticketing/offer';
import { deepen, flyerTint } from '@/server/content/flyer-tint';
import { hexToRgb } from '@/lib/appearance/contrast';
import type { EventArtwork } from '@/components/events/EventArt';

/**
 * One special event, on one screen.
 *
 * Everything a guest needs to decide and buy lives in a single band: the name,
 * when, the flyer they already saw on Instagram, the price with a way to pay,
 * what to expect, and how to get here. Nothing is held back behind a scroll —
 * a night out is one decision, so it is one block of page.
 *
 * The two columns are independent (see `.event-grid` in event-page.css):
 * neither waits on the other's height, so a short description can never open a
 * hole under the title. On a phone the same five blocks stack in the order a
 * guest reads them — flyer, name and date, tickets, the detail, the address.
 *
 * Every fact still has exactly one home. The facts line carries the date, the
 * time and the town; the ticket box carries the price and the sale state; the
 * prose carries anything that needs a sentence.
 */
export async function EventPage({
  event,
  settings,
  offer,
  artwork,
  upcoming,
}: {
  event: ResolvedEvent;
  settings: SiteSettings;
  offer: TicketOffer;
  artwork: EventArtwork;
  /** Other standalone events coming up, with their own flyers and offers. */
  upcoming: { event: ResolvedEvent; flyer: PublicAsset | null; offer: TicketOffer }[];
}) {
  const flyer = artwork.flyer;
  const preset = PRESET_STYLE[event.presentation.visualPreset];
  const tint = event.details.accentHint ? deepenHex(event.details.accentHint) : await flyerTint(flyer?.path ?? null, preset.surface);
  const ended = Date.parse(event.endsAt) <= Date.now();
  const off = ended || event.status === 'cancelled' || event.status === 'postponed';
  const category = event.presentation.category;
  const address = `${settings.street}, ${settings.locality}, ${settings.region} ${settings.postalCode}`;
  const headline = isSoldOut(offer) ? 'Sold out' : priceHeadline(offer);
  const soldOut = isSoldOut(offer);

  // The short line under the title is the summary. When there is none, the
  // first paragraph of the description stands in, and is not repeated below.
  const paragraphs = event.description.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const lead = event.summary.trim() || paragraphs[0] || '';
  const prose = event.summary.trim() ? paragraphs : paragraphs.slice(1);
  const richHtml = event.details.descriptionHtml?.trim() || null;
  // The sentences the editor collects, each said once, only when there is one.
  const sentences = [event.details.includedText, event.details.bringText, event.details.arrivalText]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));

  const ageLine = event.ageMin ? `${event.ageMin}+` : 'All ages';
  const showBar = !off;
  const barAction =
    offer.kind === 'external' && !soldOut
      ? ({ kind: 'external', url: offer.url, label: offer.label ?? 'Get tickets' } as const)
      : soldOut
        ? ({ kind: 'scroll', label: 'Join the waitlist' } as const)
        : offer.kind === 'tiers'
          ? ({ kind: 'scroll', label: 'Get tickets' } as const)
          : null;

  // Is there anything to say beyond the lead? If not, the detail block is left
  // out entirely rather than padded with a stock sentence.
  const hasDetail = Boolean(richHtml) || prose.length > 0 || sentences.length > 1 || Boolean(event.ageNote);

  return (
    <>
      {off ? (
        <Band surface="ivory-deep" size="sm">
          <Frame wide>
            <p className="measure text-[1rem] leading-relaxed text-brown">
              {ended
                ? 'This one has passed. Here is what is coming up.'
                : event.status === 'cancelled'
                  ? 'This event has been cancelled. If you bought a ticket, the seller will be in touch.'
                  : 'This event has been postponed. A new date is coming; tickets already bought will carry over.'}
            </p>
          </Frame>
        </Band>
      ) : null}

      <section
        className="o-band event-section relative isolate overflow-hidden bg-espresso on-dark"
        style={{ '--e-accent': preset.accent, '--e-surface': preset.surface, '--flyer-tint': tint } as React.CSSProperties}
        aria-labelledby="event-title"
      >
        <EventDecor category={category} />
        <Frame wide className="z-10">
          <div className={`event-grid ${flyer ? '' : 'event-grid-noart'}`}>
            {/* The main column: the words. */}
            <div className="event-col-main">
              <div className="event-slot-head">
                {category ? (
                  <p className="text-[0.875rem] font-semibold text-[color:var(--e-accent)]">
                    {CATEGORY_LABEL[category]}
                  </p>
                ) : null}
                <h1
                  id="event-title"
                  className="display mt-2 max-w-[14ch] text-[clamp(2.25rem,5.4vw,3.75rem)] leading-[0.92] text-night-text"
                >
                  {event.title}
                </h1>

                <ul className="event-facts tabular mt-4 text-[1.0625rem] font-medium text-night-text">
                  <li>{formatEventDateCompact(event.startsAt)}</li>
                  <li>{formatTimeRangeCompact(event.startsAt, event.endsAt)}</li>
                  <li>{settings.locality}</li>
                </ul>

                {lead ? (
                  <p className="measure mt-5 text-[length:var(--text-body-lg)] leading-relaxed text-night-soft">
                    {lead}
                  </p>
                ) : null}

                <ul className="event-facts mt-4 text-[0.9375rem] text-night-soft">
                  <li>{event.ticketing.agePolicy === '18+' ? '18+' : event.ticketing.agePolicy === '21+' ? '21+' : ageLine}</li>
                  {event.details.includedText?.trim() ? <li>{event.details.includedText.trim()}</li> : null}
                  {event.musicFormats.length > 0 ? <li>{event.musicFormats.join(', ')}</li> : null}
                  {event.venueName !== settings.name ? <li>{event.venueName}</li> : null}
                </ul>
              </div>

              {hasDetail ? (
                <div className="event-slot-body border-t border-night-text/12 pt-6">
                  <h2 className="eyebrow text-night-text/50">What to expect</h2>
                  <div className="measure event-prose mt-3 space-y-4 text-[1rem] leading-relaxed text-night-soft">
                    {richHtml ? (
                      // Sanitised on the server when saved; bold, italic, links and lists only.
                      <div dangerouslySetInnerHTML={{ __html: richHtml }} />
                    ) : (
                      prose.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)
                    )}
                    {sentences.slice(1).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {event.ageNote ? <p>{event.ageNote}</p> : null}
                  </div>
                </div>
              ) : null}
              <div className="event-slot-here border-t border-night-text/12 pt-6">
                <h2 className="eyebrow text-night-text/50">Getting here</h2>
                <p className="mt-3 text-[1rem] leading-relaxed text-night-text">
                  {event.venueName}
                  <span className="block text-night-soft">{address}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                  <ExternalTextLink href={settings.directionsUrl} destination="the fictional location page" className="text-[#ddc79f]">
                    Directions
                  </ExternalTextLink>
                  {!off ? (
                    <ExternalTextLink href={addToCalendarUrl(event, address)} destination="Google Calendar" className="text-[#ddc79f]">
                      Add to calendar
                    </ExternalTextLink>
                  ) : null}
                </div>
              </div>
            </div>

            {/* The side column: the flyer and the ticket box. On a phone these
                two unstack into positions 1 and 3 of a single column. */}
            <div className="event-col-side">
              {flyer?.path ? (
                <figure className="event-slot-art">
                  <div
                    className="overflow-hidden rounded-(--radius-lg) p-2.5 ring-1 ring-inset ring-night-text/12 sm:p-3"
                    style={{ background: 'var(--flyer-tint)' }}
                  >
                    <Image
                      src={flyer.path}
                      alt={flyer.alt ?? `Official flyer for ${event.title}`}
                      width={flyer.width || 1080}
                      height={flyer.height || 1080}
                      sizes="(min-width: 1024px) 38vw, 92vw"
                      priority
                      className="h-auto w-full rounded-(--radius-md) object-contain lg:max-h-[min(52vh,580px)]"
                    />
                  </div>
                </figure>
              ) : null}

              {/* The one bold element besides the title. Nothing decorative lands here. */}
              {!off ? (
                <div className="event-slot-buy relative z-10">
                  <TicketBox offer={offer} eventId={event.overrideId ?? event.id} eventSlug={event.slug ?? ''} eventTitle={event.title} />
                </div>
              ) : null}
            </div>
          </div>
        </Frame>
      </section>

      {upcoming.length > 0 ? (
        <Band surface="ivory-deep" size="sm">
          <Frame wide>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="display text-[clamp(1.5rem,2.4vw,1.875rem)] text-brown">
                {ended ? 'Coming up' : 'Also coming up'}
              </h2>
              <Link href="/events" className="inline-flex min-h-11 items-center font-semibold text-clay underline underline-offset-4">
                All events
              </Link>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((entry) => (
                <EventTile key={entry.event.id} event={entry.event} flyer={entry.flyer} offer={entry.offer} />
              ))}
            </div>
          </Frame>
        </Band>
      ) : ended ? (
        <Band surface="ivory-deep" size="sm">
          <Frame>
            <p className="text-[1rem] text-brown">Nothing else is on sale just now. The weekly nights are still on.</p>
            <div className="mt-5">
              <ButtonLink href="/events" variant="secondary">All events</ButtonLink>
            </div>
          </Frame>
        </Band>
      ) : null}

      {showBar && barAction ? <StickyBuyBar headline={headline} action={barAction} /> : null}
    </>
  );
}

/** A saved `#rrggbb` accent, deepened to a surface the way the live extractor does it. */
function deepenHex(hex: string): string {
  const rgb = hexToRgb(hex);
  return rgb ? deepen(rgb.r, rgb.g, rgb.b) : '#1b0b1a';
}
