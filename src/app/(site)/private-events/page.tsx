import type { Metadata } from 'next';
import Link from 'next/link';
import { MotionScope } from '@/components/aurelia/motion/MotionScope';
import { EditorialTitle } from '@/components/aurelia/page/EditorialTitle';
import { PageHero } from '@/components/aurelia/page/PageHero';
import { PrivateEventForm } from '@/components/forms/PrivateEventForm';
import { Asset } from '@/components/media/Asset';
import { ThemeWorld } from '@/components/theme/ThemeWorld';
import { birthdayCelebration } from '@/content/catering';
import { seo } from '@/content/pages';
import { getSiteSettings } from '@/content/resolve';
import { formatPhoneHref, formatPrice } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';
import { getPageCopy, getPageList } from '@/server/content/pages';

export const metadata: Metadata = buildMetadata({ ...seo.privateEvents!, path: '/private-events' });

const ROOMS = [
  {
    name: 'The Back Room',
    capacity: '12–36 seated',
    mood: 'One long walnut table, candles down the middle, a door that closes.',
    best: 'Rehearsal dinners, milestone birthdays, client dinners',
    asset: 'roomDetail',
  },
  {
    name: 'The Bar',
    capacity: '20–50 standing',
    mood: 'The brass rail, the record player and a bartender who is yours for the night.',
    best: 'Aperitivo receptions, launches, after-work toasts',
    asset: 'barNight',
  },
  {
    name: 'The Whole House',
    capacity: 'Up to 120 reception',
    mood: 'Every room, every candle, the kitchen cooking only for your guests.',
    best: 'Company holiday parties, engagement parties, weddings-after',
    asset: 'roomNight',
  },
];

const SERVICE = [
  ['Family-style supper', 'Platters down the table, pasta in big bowls, seconds encouraged.'],
  ['Seated tasting', 'Five courses built with the chef, wine pairings from the bar.'],
  ['Aperitivo reception', 'Negronis, spritzes, passed cicchetti and a record on.'],
  ['Late-night listening', 'Dinner, then the lights come down and a selector plays till close.'],
];

/**
 * Private dining: enough to picture the night and trust the room, then one
 * short enquiry that lands in the admin pipeline.
 */
export default async function PrivateEventsPage() {
  const [site, copy, eventTypes] = await Promise.all([getSiteSettings(), getPageCopy('private-events'), getPageList('private-events', 'types')]);

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow ?? 'Private dining'}
        title={<EditorialTitle text={copy.heading} />}
        lede={copy.body}
        asset="roomNight"
        assetTall="roomNightTall"
        focus={{ x: '52%', y: '74%' }}
        aside={
          <div className="flex flex-wrap items-center gap-4">
            <a href="#inquiry" className="cn-btn">
              Plan a gathering <span className="cn-arrow" aria-hidden="true">→</span>
            </a>
            <a href={formatPhoneHref(site.phone.value)} className="cn-link">
              {site.phone.value}
            </a>
          </div>
        }
      />

      <MotionScope as="section" className="cn-night cn-section" aria-labelledby="rooms-title">
        <div className="cn-wrap">
          <div className="cn-split-head">
            <p className="cn-eyebrow" data-m="up">
              Three ways to have the room
            </p>
            <h2 id="rooms-title" className="cn-display cn-lg" data-m="title">
              Pick the size of <em>the night.</em>
            </h2>
          </div>
          <ol className="cn-rooms-list">
            {ROOMS.map((room, index) => (
              <li key={room.name} className="cn-room-card">
                <div className="cn-photo cn-room-card-photo" data-m="image" data-delay={String(index * 0.12)}>
                  <Asset id={room.asset} rounded={false} sizes="(min-width: 900px) 30vw, 92vw" className="size-full" />
                </div>
                <div data-m="up" data-delay={String(0.2 + index * 0.12)}>
                  <p className="cn-eyebrow">{room.capacity}</p>
                  <h3 className="cn-display cn-sm mt-2">{room.name}</h3>
                  <p className="cn-body mt-3">{room.mood}</p>
                  <p className="cn-room-best">{room.best}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </MotionScope>

      <MotionScope as="section" className="cn-paper cn-grain cn-section" aria-labelledby="service-title">
        <div className="cn-wrap cn-two-col">
          <div>
            <p className="cn-eyebrow" data-m="up">
              Food &amp; service
            </p>
            <h2 id="service-title" className="cn-display cn-lg mt-4" data-m="title">
              Built with the kitchen, <em>around your people.</em>
            </h2>
            <p className="cn-lede mt-6" data-m="up">
              Tell us who is coming and what the night is for. The chef writes the menu, the bar sets the first round, and one
              host looks after you from the first call to the last candle.
            </p>
            {eventTypes.length > 0 ? (
              <ul className="cn-tags mt-8" data-m="stagger" aria-label="Gatherings we host">
                {eventTypes.map((type) => (
                  <li key={type}>{type}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <dl className="cn-service" data-m="stagger">
              {SERVICE.map(([name, text]) => (
                <div key={name}>
                  <dt className="cn-display cn-sm">{name}</dt>
                  <dd className="cn-body">{text}</dd>
                </div>
              ))}
            </dl>
            <div className="cn-birthday" data-m="up">
              <p className="cn-eyebrow">The birthday celebration</p>
              <ul>
                {birthdayCelebration.includes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="cn-body">
                {birthdayCelebration.addOns.map((addOn) => `${addOn.label} ${formatPrice(addOn.priceCents)}`).join(' · ')}
              </p>
            </div>
          </div>
        </div>
      </MotionScope>

      <MotionScope as="section" className="cn-wine-room cn-grain cn-section" aria-labelledby="inquiry-title">
        <div className="cn-wrap cn-form-layout" id="inquiry">
          <div>
            <p className="cn-eyebrow" data-m="up">
              Enquire
            </p>
            <h2 id="inquiry-title" className="cn-display cn-lg mt-4" data-m="title">
              Tell us <em>what you&apos;re planning.</em>
            </h2>
            <p className="cn-lede mt-6" data-m="up">
              A date, a rough headcount and the occasion is plenty. Your enquiry goes straight to the events team — in this demo,
              you can watch it arrive in the admin pipeline.
            </p>
            <ol className="cn-steps" data-m="stagger">
              <li>
                <b>Tonight</b> Your enquiry lands with the events team.
              </li>
              <li>
                <b>Within a day</b> A host calls to talk menus, rooms and timing.
              </li>
              <li>
                <b>Your night</b> We hold the room, you bring the people.
              </li>
            </ol>
            <Link href="/demo/admin" className="cn-link mt-6">
              See the admin side →
            </Link>
          </div>
          <div className="cn-card-paper" data-m="up" data-delay="0.2">
            <PrivateEventForm phone={site.phone.value} eventTypes={eventTypes} />
          </div>
        </div>
      </MotionScope>
      <ThemeWorld scene="music" />
    </>
  );
}
