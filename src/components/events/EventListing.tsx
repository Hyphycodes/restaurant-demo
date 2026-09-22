import Link from 'next/link';
import { EventArt, presetVars, type EventArtwork } from '@/components/events/EventArt';
import { eventHref, priceLabel, StatusChip } from '@/components/events/EventBits';
import { CATEGORY_LABEL } from '@/content/event-presentation';
import type { ResolvedEvent } from '@/content/types';
import { formatEventDate, formatEventDateLong, formatEventTime, formatTimeRange } from '@/lib/format';



function CategoryLabel({ event }: { event: ResolvedEvent }) {
  const category = event.presentation.category;
  if (!category) return null;
  return <span className="eyebrow text-[color:var(--e-accent)]">{CATEGORY_LABEL[category]}</span>;
}

export function EventBanner({
  event,
  artwork,
  eyebrow,
}: {
  event: ResolvedEvent;
  artwork: EventArtwork;
  eyebrow: string;
}) {
  const price = priceLabel(event);

  return (
    <article
      className="group grid gap-5 overflow-hidden rounded-(--radius-lg) border border-night-text/12 bg-espresso p-4 on-dark sm:gap-8 sm:p-7 md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] md:items-center"
      style={presetVars(event.presentation.visualPreset)}
    >
      {/* The picture and the title link to the same place; see EventCard. */}
      <Link href={eventHref(event)} aria-hidden="true" tabIndex={-1}>
        <EventArt
          art={artwork}
          title={event.title}
          preset={event.presentation.visualPreset}
          size="card"
          sizes="(min-width: 768px) 24rem, 92vw"
          priority
        />
      </Link>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="eyebrow text-night-text/70">{eyebrow}</span>
          <CategoryLabel event={event} />
          <StatusChip event={event} />
        </div>

        <h2 className="display max-w-3xl text-[clamp(1.75rem,3.6vw,3rem)] leading-[1.02] text-night-text">
          <Link href={eventHref(event)} className="hover:text-[color:var(--e-accent)]">
            {event.title}
          </Link>
        </h2>

        <p className="tabular text-[1.125rem] font-semibold text-[color:var(--e-accent)]">
          {formatEventDateLong(event.startsAt)} · {formatTimeRange(event.startsAt, event.endsAt)}
        </p>

        {event.summary ? (
          <p className="measure text-[1rem] leading-relaxed text-night-soft">{event.summary}</p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-3">
          {event.ticketUrl && event.status !== 'sold-out' ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-(--radius-md) bg-coral px-6 text-[1rem] font-semibold text-on-orange transition-colors hover:bg-coral-deep"
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
          <span className="text-[0.9375rem] text-night-soft">{event.venueName}</span>
        </div>
      </div>
    </article>
  );
}

export function EventCard({ event, artwork }: { event: ResolvedEvent; artwork: EventArtwork }) {
  const price = priceLabel(event);

  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-(--radius-lg) border border-night-text/12 bg-obsidian/60 transition-colors hover:border-[color:var(--e-accent)]/45"
      style={presetVars(event.presentation.visualPreset)}
    >
      {/* The picture and the title link to the same place. Giving the picture
          its own label would make a screen reader announce the event twice and
          add a tab stop that goes nowhere new, so it is hidden from assistive
          technology instead — it stays clickable for a pointer. */}
      <Link href={eventHref(event)} className="block" aria-hidden="true" tabIndex={-1}>
        <EventArt
          art={artwork}
          title={event.title}
          preset={event.presentation.visualPreset}
          size="card"
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
          className="rounded-b-none"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <CategoryLabel event={event} />
          <StatusChip event={event} />
        </div>

        <h3 className="display text-[1.375rem] leading-tight text-night-text">
          <Link href={eventHref(event)} className="hover:text-[color:var(--e-accent)]">
            {event.title}
          </Link>
        </h3>

        <p className="tabular text-[0.9375rem] font-semibold text-[color:var(--e-accent)]">
          {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt)}
        </p>

        {event.summary ? (
          <p className="line-clamp-2 text-[0.875rem] leading-relaxed text-night-soft">
            {event.summary}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
          {event.ticketUrl && event.status !== 'sold-out' ? (
            <a
              href={event.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-[0.875rem] font-semibold text-[color:var(--e-accent)] underline underline-offset-4"
            >
              Get tickets
              <span className="sr-only">for {event.title} (opens the ticket page in a new tab)</span>
            </a>
          ) : null}
          {price ? <span className="tabular text-[0.875rem] text-night-soft">{price}</span> : null}
        </div>
      </div>
    </article>
  );
}

/**
 * The ordinary calendar line.
 *
 * The date is set as its own block on the left, the way a calendar reads, so
 * the column scans as dates first and names second.
 */
export function EventRow({ event, artwork }: { event: ResolvedEvent; artwork: EventArtwork }) {
  const price = priceLabel(event);
  const [weekday, day] = formatEventDate(event.startsAt).split(', ');

  return (
    <article
      className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-brown/12 py-4 last:border-b-0 sm:grid-cols-[5rem_9rem_minmax(0,1fr)_auto] sm:gap-x-6"
      style={presetVars(event.presentation.visualPreset)}
    >
      <p className="tabular w-20 shrink-0 sm:w-auto">
        <span className="block text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-brown-soft">
          {weekday}
        </span>
        <span className="block text-[1.25rem] font-semibold leading-tight text-brown">{day}</span>
        <span className="block text-[0.8125rem] text-brown-soft">
          {formatEventTime(event.startsAt)}
        </span>
      </p>

      {/* The picture and the title link to the same place. Giving the picture
          its own label would make a screen reader announce the event twice and
          add a tab stop that goes nowhere new, so it is hidden from assistive
          technology instead — it stays clickable for a pointer. */}
      <Link
        href={eventHref(event)}
        className="hidden w-36 sm:block"
        aria-hidden="true"
        tabIndex={-1}
      >
        <EventArt
          art={artwork}
          title={event.title}
          preset={event.presentation.visualPreset}
          size="card"
          sizes="144px"
        />
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="display text-[1.125rem] leading-tight text-brown">
            <Link href={eventHref(event)} className="hover:text-coral-deep">
              {event.title}
            </Link>
          </h3>
          <StatusChip event={event} />
        </div>
        {event.summary ? (
          <p className="measure mt-1 line-clamp-1 text-[0.875rem] text-brown-soft">{event.summary}</p>
        ) : null}
        {price ? <p className="tabular mt-1 text-[0.875rem] text-brown-soft sm:hidden">{price}</p> : null}
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-span-1 sm:justify-end">
        {price ? <span className="tabular hidden text-[0.875rem] text-brown-soft sm:inline">{price}</span> : null}
        {event.ticketUrl && event.status !== 'sold-out' ? (
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-(--radius-md) border border-brown/25 px-4 text-[0.875rem] font-semibold text-brown transition-colors hover:border-coral hover:text-coral-deep"
          >
            Get tickets
            <span className="sr-only">for {event.title} (opens the ticket page in a new tab)</span>
          </a>
        ) : (
          <Link
            href={eventHref(event)}
            className="inline-flex min-h-11 items-center text-[0.875rem] font-semibold text-brown underline underline-offset-4"
          >
            Details
          </Link>
        )}
      </div>
    </article>
  );
}
