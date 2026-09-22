import Image from 'next/image';
import Link from 'next/link';
import { eventHref } from '@/components/events/EventBits';
import { CATEGORY_LABEL } from '@/content/event-presentation';
import { PRESET_STYLE } from '@/content/event-presentation';
import type { PublicAsset } from '@/content/media';
import type { ResolvedEvent } from '@/content/types';
import { formatEventDateCompact, formatTimeRangeCompact } from '@/lib/format';
import { isSoldOut, priceHeadline, type TicketOffer } from '@/lib/ticketing/offer';

/**
 * One event, in miniature: the flyer, the date, the name, the price.
 *
 * The same four things the event page opens with, in the same order, so the
 * calendar and the page read as one system. The flyer is contained inside a
 * square frame tinted the event's own colour and is never cropped.
 */
export function EventTile({
  event,
  flyer,
  offer,
  tone = 'light',
  priority = false,
}: {
  event: ResolvedEvent;
  flyer: PublicAsset | null;
  offer: TicketOffer;
  tone?: 'light' | 'dark';
  priority?: boolean;
}) {
  const href = eventHref(event);
  const surface = PRESET_STYLE[event.presentation.visualPreset].surface;
  const soldOut = isSoldOut(offer) || event.status === 'sold-out';
  const off = event.status === 'cancelled' || event.status === 'postponed';
  const category = event.presentation.category;
  const dark = tone === 'dark';

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-(--radius-lg) border transition-colors ${
        dark
          ? 'border-night-text/12 bg-obsidian/60 hover:border-amber/50'
          : 'border-brown/12 bg-linen hover:border-coral/50'
      }`}
    >
      {/* The picture and the title link to the same place; the picture is
          hidden from assistive technology so the event is announced once. */}
      <Link href={href} aria-hidden="true" tabIndex={-1} className="block">
        <div className="relative aspect-square w-full" style={{ background: surface }}>
          {flyer?.path ? (
            <Image
              src={flyer.path}
              alt=""
              fill
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
              priority={priority}
              loading={priority ? undefined : 'lazy'}
              className="object-contain p-3"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center px-6 text-center">
              <span className="display-poster text-[1.5rem] leading-[0.95] text-night-text/90">{event.title}</span>
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4 sm:p-5">
        <p className={`tabular text-[0.875rem] font-semibold ${dark ? 'text-amber' : 'text-clay'}`}>
          {formatEventDateCompact(event.startsAt)} · {formatTimeRangeCompact(event.startsAt, event.endsAt)}
        </p>
        <h3 className={`display text-[1.375rem] leading-[1.02] ${dark ? 'text-night-text' : 'text-brown'}`}>
          <Link href={href} className={dark ? 'hover:text-amber' : 'hover:text-coral-deep'}>
            {event.title}
          </Link>
        </h3>
        <p className={`mt-auto flex flex-wrap items-baseline gap-x-3 pt-2 text-[0.9375rem] ${dark ? 'text-night-soft' : 'text-brown-soft'}`}>
          <span className={`tabular font-semibold ${dark ? 'text-night-text' : 'text-brown'}`}>
            {off ? (event.status === 'cancelled' ? 'Cancelled' : 'Postponed') : soldOut ? 'Sold out' : priceHeadline(offer)}
          </span>
          {category ? <span>{CATEGORY_LABEL[category]}</span> : null}
        </p>
      </div>
    </article>
  );
}
