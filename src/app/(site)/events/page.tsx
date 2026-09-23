import type { Metadata } from 'next';
import Link from 'next/link';
import { EventArt, presetVars } from '@/components/events/EventArt';
import { eventHref, priceLabel } from '@/components/events/EventBits';
import { dateParts, EventRow } from '@/components/cosa/events/EventRow';
import { MotionScope } from '@/components/cosa/motion/MotionScope';
import { EditorialTitle } from '@/components/cosa/page/EditorialTitle';
import { PageHero } from '@/components/cosa/page/PageHero';
import { ThemeWorld } from '@/components/theme/ThemeWorld';
import { CATEGORY_FILTERS, CATEGORY_LABEL } from '@/content/event-presentation';
import { seo } from '@/content/pages';
import { getSiteSettings } from '@/content/resolve';
import { buildCalendar, type CategoryFilter } from '@/lib/event-calendar';
import { formatEventTime, formatTimeRange } from '@/lib/format';
import { absoluteUrl, buildMetadata, eventJsonLd, JsonLd } from '@/lib/seo';
import { resolveManyEventArtwork } from '@/server/content/event-art';
import { getPublicEvents } from '@/server/content/events';
import { getPageCopy } from '@/server/content/pages';
import { offersFor } from '@/server/ticketing/offer';

export const metadata: Metadata = buildMetadata({ ...seo.events!, path: '/events' });
export const dynamic = 'force-dynamic';

/**
 * What's on. The next night leads like a poster; the rest of the season reads
 * like a club listing, month by month; the weekly nights close the page.
 * Past events fall away on their own — everything comes from buildCalendar.
 */
export default async function EventsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const now = new Date();
  const [{ kind }, input, copy, settings] = await Promise.all([searchParams, getPublicEvents(), getPageCopy('events'), getSiteSettings()]);

  const filter: CategoryFilter = kind && (CATEGORY_FILTERS as string[]).includes(kind) ? (kind as CategoryFilter) : 'all';
  const calendar = buildCalendar(input, now, filter);
  const weekly = calendar.weekly;
  const listed = [
    ...new Map([...(calendar.lead ? [calendar.lead] : []), ...calendar.months.flatMap((month) => month.events)].map((event) => [event.id, event])).values(),
  ];
  const [artwork, offers, weeklyArt] = await Promise.all([resolveManyEventArtwork(listed), offersFor(listed), resolveManyEventArtwork(weekly)]);
  const lead = calendar.lead;
  const chips = [
    { value: 'all' as CategoryFilter, label: 'Everything' },
    ...CATEGORY_FILTERS.filter((category) => (calendar.counts[category] ?? 0) > 0).map((category) => ({ value: category as CategoryFilter, label: CATEGORY_LABEL[category] })),
  ];

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow ?? 'What’s on'}
        title={<EditorialTitle text={copy.heading ?? 'The evening has a rhythm.'} />}
        lede={
          calendar.total === 0
            ? 'Nothing special is on sale right now — the kitchen and the bar are open every night.'
            : `${calendar.total} ${calendar.total === 1 ? 'night' : 'nights'} on the calendar${weekly.length ? `, plus ${weekly.length} weekly ${weekly.length === 1 ? 'night' : 'nights'}` : ''}. Aperitivo hours, listening rooms, long suppers.`
        }
        asset="barNight"
        focus={{ x: '45%', y: '35%' }}
      >
        {chips.length > 2 ? (
          <nav aria-label="Filter events by kind">
            <ul className="cn-filter">
              {chips.map((chip) => (
                <li key={chip.value}>
                  <Link
                    href={chip.value === 'all' ? '/events' : `/events?kind=${chip.value}`}
                    scroll={false}
                    aria-current={chip.value === filter ? 'true' : undefined}
                  >
                    {chip.label} <span className="cn-num">{calendar.counts[chip.value] ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </PageHero>

      {lead ? (
        <MotionScope as="section" className="cn-wine-room cn-grain cn-section-tight" aria-labelledby="lead-title">
          <div className="cn-wrap cn-lead" style={presetVars(lead.presentation.visualPreset)}>
            <div className="cn-lead-art" data-m="image">
              <EventArt art={artwork.get(lead.id)!} title={lead.title} preset={lead.presentation.visualPreset} size="lead" priority sizes="(min-width: 900px) 40vw, 92vw" />
            </div>
            <div className="cn-lead-copy">
              <p className="cn-eyebrow" data-m="up">
                Next up · {dateParts(lead.startsAt).weekday} {dateParts(lead.startsAt).month} {dateParts(lead.startsAt).day}
              </p>
              <h2 id="lead-title" className="cn-display cn-lg" data-m="title">
                {lead.title}
              </h2>
              {lead.summary ? (
                <p className="cn-lede" data-m="up">
                  {lead.summary}
                </p>
              ) : null}
              <dl className="cn-lead-facts cn-num" data-m="stagger">
                <div>
                  <dt className="cn-eyebrow">When</dt>
                  <dd>{formatTimeRange(lead.startsAt, lead.endsAt)}</dd>
                </div>
                <div>
                  <dt className="cn-eyebrow">Entry</dt>
                  <dd>{priceLabel(lead) ?? (lead.ticketing.enabled ? 'Ticketed' : 'Free')}</dd>
                </div>
                {lead.ticketing.capacity ? (
                  <div>
                    <dt className="cn-eyebrow">Room</dt>
                    <dd>{lead.ticketing.capacity} guests</dd>
                  </div>
                ) : null}
                {lead.ageMin ? (
                  <div>
                    <dt className="cn-eyebrow">Age</dt>
                    <dd>{lead.ageMin}+</dd>
                  </div>
                ) : null}
              </dl>
              <div className="flex flex-wrap gap-3" data-m="up">
                <Link href={eventHref(lead)} className="cn-btn">
                  {lead.ticketing.enabled ? 'Get tickets' : 'The details'} <span className="cn-arrow" aria-hidden="true">→</span>
                </Link>
                <Link href={settings.reservationUrl} className="cn-btn cn-btn-ghost">
                  Dinner before
                </Link>
              </div>
            </div>
          </div>
        </MotionScope>
      ) : null}

      <section className="cn-night cn-section-tight" aria-label="The calendar">
        <div className="cn-wrap">
          {calendar.months.length === 0 ? (
            <p className="cn-lede">
              Nothing matches that kind of night right now. <Link href="/events" className="cn-link">See everything</Link>
            </p>
          ) : (
            calendar.months.map((month) => (
              <MotionScope key={month.key} as="section" className="cn-month" aria-labelledby={`month-${month.key}`}>
                <h2 id={`month-${month.key}`} className="cn-display cn-md" data-m="title">
                  {month.label}
                </h2>
                <ol className="cn-erows" data-m="stagger">
                  {month.events.map((event) => (
                    <EventRow key={event.id} event={event} art={artwork.get(event.id)} />
                  ))}
                </ol>
              </MotionScope>
            ))
          )}
        </div>
      </section>

      {weekly.length > 0 ? (
        <MotionScope as="section" className="cn-walnut cn-grain cn-section" aria-labelledby="weekly-title">
          <div className="cn-wrap">
            <p className="cn-eyebrow" data-m="up">
              Every week
            </p>
            <h2 id="weekly-title" className="cn-display cn-lg mt-4" data-m="title">
              The nights that <em>come round again.</em>
            </h2>
            <div className="cn-weekly" data-m="stagger">
              {weekly.map((event) => (
                <Link key={event.id} href={eventHref(event)} className="cn-weekly-card" style={presetVars(event.presentation.visualPreset)}>
                  <div className="cn-weekly-art">
                    <EventArt art={weeklyArt.get(event.id)!} title={event.title} preset={event.presentation.visualPreset} size="card" sizes="(min-width: 900px) 30vw, 90vw" />
                  </div>
                  <div>
                    <p className="cn-eyebrow">
                      Every {dateParts(event.startsAt).weekday} · from {formatEventTime(event.startsAt)}
                    </p>
                    <h3 className="cn-display cn-sm mt-2">{event.title}</h3>
                    {event.summary ? <p className="cn-body mt-3">{event.summary}</p> : null}
                    <span className="cn-link mt-3">All dates →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </MotionScope>
      ) : null}

      {listed.map((event) => (
        <JsonLd
          key={event.id}
          data={eventJsonLd(event, settings, {
            offer: offers.get(event.id),
            image: artwork.get(event.id)?.flyer?.path ? absoluteUrl(artwork.get(event.id)!.flyer!.path!) : null,
          })}
        />
      ))}
      <ThemeWorld scene="listening" />
    </>
  );
}
