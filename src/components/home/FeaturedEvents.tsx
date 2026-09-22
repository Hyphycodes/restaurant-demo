import Link from 'next/link';
import { EventArt, presetVars } from '@/components/events/EventArt';
import { Frame } from '@/components/primitives/Band';
import { Reveal } from '@/components/primitives/Reveal';
import { eventHref, priceLabel, StatusChip } from '@/components/events/EventBits';
import { CATEGORY_LABEL } from '@/content/event-presentation';
import type { ResolvedEvent } from '@/content/types';
import { formatEventDate, formatEventTime } from '@/lib/format';
import { resolveManyEventArtwork } from '@/server/content/event-art';
import type { HomepageEvents } from '@/lib/event-feature';


export async function FeaturedEvents({
  events,
  heading,
}: {
  events: HomepageEvents;
  heading?: string;
}) {
  const { lead, supporting } = events;
  if (!lead) return null;

  const artwork = await resolveManyEventArtwork([lead, ...supporting]);

  return (
    // Top padding steps up to the larger rhythm token so this reads as the
    // NEXT section rather than a continuation of the hero/utility-row
    // cluster above it; the bottom keeps the tighter one, since the scene
    // that follows is already its own clear break.
    <section
      className="o-band relative isolate bg-espresso on-dark pb-(--spacing-band-sm) pt-(--spacing-band)"
      aria-labelledby="whats-on"
    >
      <Frame wide>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
            <div>
              <p className="eyebrow text-amber">What&apos;s on</p>
              <h2
                id="whats-on"
                className="display mt-3.5 text-[clamp(1.75rem,3vw,2.375rem)] leading-[1.08] text-night-text"
              >
                {heading ?? 'The evening has a rhythm.'}
              </h2>
            </div>
            <Link
              href="/events"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) border border-night-text/30 px-5 text-[0.9375rem] font-semibold text-night-text transition-colors hover:bg-night-text/10"
            >
              All events
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </Reveal>

        {/* The lead takes its own row rather than a column beside the pair.
            Side by side, the supporting column set the row height and the lead
            had to stretch to match it — which is what opened a hole above its
            buttons. On its own row it is as tall as its own content. */}
        <div className="mt-9 grid gap-5 sm:gap-6">
          <Reveal>
            <LeadEvent event={lead} artwork={artwork.get(lead.id)!} />
          </Reveal>

          {supporting.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
              {supporting.map((event, index) => (
                <Reveal key={event.id} delay={60 + index * 60}>
                  <SupportingEvent event={event} artwork={artwork.get(event.id)!} />
                </Reveal>
              ))}
            </div>
          ) : null}
        </div>
      </Frame>
    </section>
  );
}

/**
 * The dominant card: the flyer beside the facts.
 *
 * The flyer is the thing a guest recognises, so it gets a real column of its
 * own rather than a corner stamp on top of a generated background. The facts
 * sit beside it on a wide screen and under it on a phone.
 */
function LeadEvent({ event, artwork }: { event: ResolvedEvent; artwork: Parameters<typeof EventArt>[0]['art'] }) {
  const price = priceLabel(event);
  const category = event.presentation.category;

  return (
    <article
      className="group grid gap-5 overflow-hidden rounded-(--radius-lg) border border-night-text/12 bg-obsidian/60 p-4 sm:gap-7 sm:p-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:items-center"
      style={presetVars(event.presentation.visualPreset)}
    >
      {/* The picture and the title link to the same place. Giving the picture
          its own label would make a screen reader announce the event twice and
          add a tab stop that goes nowhere new, so it is hidden from assistive
          technology instead — it stays clickable for a pointer. */}
      <Link href={eventHref(event)} aria-hidden="true" tabIndex={-1}>
        <EventArt
          art={artwork}
          title={event.title}
          preset={event.presentation.visualPreset}
          size="lead"
          sizes="(min-width: 768px) 26rem, 92vw"
        />
      </Link>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {category ? (
            <span className="eyebrow text-[color:var(--e-accent)]">{CATEGORY_LABEL[category]}</span>
          ) : null}
          <StatusChip event={event} />
        </div>

        <h3 className="display text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.02] text-night-text">
          <Link href={eventHref(event)} className="hover:text-[color:var(--e-accent)]">
            {event.title}
          </Link>
        </h3>

        <p className="tabular text-[1.0625rem] font-semibold text-[color:var(--e-accent)]">
          {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt)}
        </p>

        {event.summary ? (
          <p className="measure text-[0.9375rem] leading-relaxed text-night-soft">{event.summary}</p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-3">
          {event.ticketUrl && event.status !== 'sold-out' ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-coral px-5 text-[0.9375rem] font-semibold text-on-orange transition-colors hover:bg-coral-deep"
            >
              Get tickets
              <span className="sr-only">for {event.title} (opens the ticket page in a new tab)</span>
            </a>
          ) : null}
          <Link
            href={eventHref(event)}
            className="inline-flex min-h-11 items-center text-[0.9375rem] font-semibold text-night-text underline underline-offset-4 hover:underline-offset-[6px]"
          >
            Full details
          </Link>
          {price ? <span className="tabular text-[0.9375rem] text-night-soft">{price}</span> : null}
        </div>
      </div>
    </article>
  );
}

function SupportingEvent({
  event,
  artwork,
}: {
  event: ResolvedEvent;
  artwork: Parameters<typeof EventArt>[0]['art'];
}) {
  const price = priceLabel(event);

  return (
    <article
      // A ROW on a phone, a stacked card from `sm`.
      //
      // Stacked, each supporting event put a near-square flyer across the full
      // width of the screen before it said a single fact, so the two of them
      // cost about two and a half phone screens of scrolling and the section
      // read as a pile of posters rather than a list of nights. As a row the
      // flyer becomes a thumbnail and the facts sit beside it, which is the
      // shape a list of dates wants: scannable top to bottom, one line of
      // travel per event. The lead event above keeps the full poster, so the
      // hierarchy gets sharper rather than flatter.
      className="group flex h-full flex-row overflow-hidden rounded-(--radius-lg) border border-night-text/12 bg-obsidian/60 transition-colors hover:border-[color:var(--e-accent)]/45 sm:flex-col"
      style={presetVars(event.presentation.visualPreset)}
    >
      {/* The picture and the title link to the same place. Giving the picture
          its own label would make a screen reader announce the event twice and
          add a tab stop that goes nowhere new, so it is hidden from assistive
          technology instead — it stays clickable for a pointer. */}
      <Link
        href={eventHref(event)}
        className="block w-28 shrink-0 self-stretch sm:w-auto sm:self-auto"
        aria-hidden="true"
        tabIndex={-1}
      >
        <EventArt
          art={artwork}
          title={event.title}
          preset={event.presentation.visualPreset}
          size="card"
          // A 7rem thumbnail on a phone, half the row from `sm`.
          sizes="(min-width: 1024px) 34vw, (min-width: 640px) 45vw, 7rem"
          className="cn-event-thumbnail rounded-none sm:rounded-(--radius-lg) sm:rounded-b-none"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5 sm:gap-2 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="tabular text-[0.9375rem] font-semibold text-[color:var(--e-accent)]">
            {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt)}
          </p>
          <StatusChip event={event} />
        </div>

        <h3 className="display text-[1.25rem] leading-tight text-night-text">
          <Link href={eventHref(event)} className="hover:text-[color:var(--e-accent)]">
            {event.title}
          </Link>
        </h3>

        {event.summary ? (
          <p className="line-clamp-2 text-[0.875rem] leading-relaxed text-night-soft">
            {event.summary}
          </p>
        ) : null}

        {price ? <p className="tabular mt-auto pt-1 text-[0.875rem] text-night-soft">{price}</p> : null}
      </div>
    </article>
  );
}
