import Link from 'next/link';
import { EventArt, presetVars } from '@/components/events/EventArt';
import { eventHref, priceLabel } from '@/components/events/EventBits';
import { CATEGORY_LABEL } from '@/content/event-presentation';
import type { ResolvedEvent } from '@/content/types';
import { formatEventTime } from '@/lib/format';
import { resolveManyEventArtwork } from '@/server/content/event-art';
import { NightsDirector } from './NightsDirector';

const TILTS = [-3.5, 2.2, -1.2, 3];

function dayParts(iso: string) {
  const date = new Date(iso);
  const tz = 'America/Chicago';
  return {
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(date),
    day: new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: tz }).format(date),
    month: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: tz }).format(date),
  };
}

export async function Nights({ events }: { events: ResolvedEvent[] }) {
  if (events.length === 0) return null;
  const artwork = await resolveManyEventArtwork(events);

  return (
    <NightsDirector>
      <div className="cn-wrap">
        <div className="cn-nights-head">
          <p className="cn-eyebrow">What&apos;s on</p>
          <h2 id="nights-title" className="cn-display cn-lg">
            Every night has <em>a second act.</em>
          </h2>
          <p className="cn-lede">
            Aperitivo hours, listening nights, long Sunday suppers. Some are free, some are ticketed, all of them run late.
          </p>
          <Link href="/events" className="cn-link">
            The full calendar <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ol className="cn-flyers">
          {events.map((event, index) => {
            const parts = dayParts(event.startsAt);
            const price = priceLabel(event);
            const category = event.presentation.category;
            return (
              <li
                key={event.id}
                className="cn-flyer"
                data-m
                data-tilt={TILTS[index % TILTS.length]}
                style={{ ...presetVars(event.presentation.visualPreset), rotate: `${TILTS[index % TILTS.length]}deg` }}
              >
                <Link href={eventHref(event)} className="cn-flyer-link">
                  <div className="cn-flyer-art">
                    <EventArt
                      art={artwork.get(event.id)!}
                      title={event.title}
                      preset={event.presentation.visualPreset}
                      size="card"
                      sizes="(min-width: 900px) 24vw, 70vw"
                    />
                  </div>
                  <div className="cn-flyer-meta">
                    <p className="cn-flyer-date cn-num">
                      <span>{parts.weekday}</span>
                      <strong>{parts.day}</strong>
                      <span>{parts.month}</span>
                    </p>
                    <div>
                      {category ? <p className="cn-eyebrow">{CATEGORY_LABEL[category]}</p> : null}
                      <h3>{event.title}</h3>
                      <p className="cn-num">
                        {formatEventTime(event.startsAt)}
                        {price ? ` · ${price}` : ''}
                        {event.status === 'sold-out' ? ' · Sold out' : ''}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </NightsDirector>
  );
}
