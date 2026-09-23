import type { Metadata } from 'next';
import Link from 'next/link';
import { MotionScope } from '@/components/cosa/motion/MotionScope';
import { EditorialTitle } from '@/components/cosa/page/EditorialTitle';
import { NeighborhoodMap } from '@/components/cosa/page/NeighborhoodMap';
import { PageHero } from '@/components/cosa/page/PageHero';
import { ThemeWorld } from '@/components/theme/ThemeWorld';
import { pageCopy, seo } from '@/content/pages';
import { getSiteSettings } from '@/content/resolve';
import { formatPhoneHref } from '@/lib/format';
import { getOpenState, groupHours } from '@/lib/hours';
import { buildMetadata } from '@/lib/seo';
import { getPageCopy } from '@/server/content/pages';

export const metadata: Metadata = buildMetadata({ ...seo.visit!, path: '/visit' });
export const dynamic = 'force-dynamic';

const ARRIVING = [
  ['By train', 'Morgan station on the Green and Pink lines, five minutes on foot. Walk south on Morgan and look for the brass sconce.'],
  ['By car', 'Valet at the door Thursday to Saturday from 5pm. Metered street parking on Randolph after 6pm.'],
  ['Rideshare', 'Set your drop-off to the corner of Morgan and Randolph; the green door is thirty steps east.'],
  ['On two wheels', 'A bike dock on the corner of Carpenter. Bring your helmet inside — we have a hook for it.'],
];

const BEFORE = [
  ['Walk-ins', 'The bar and its eight stools are never booked. Come early, stay late.'],
  ['Dress', 'Come as you are. Most people dress up a little because the room makes them want to.'],
  ['Children', 'Welcome for dinner until 8pm. The Listening Room is 21+ after nine.'],
  ['Accessibility', 'Step-free entrance on the alley side, accessible restroom on the ground floor.'],
];

/** Everything practical about getting to the table, in one calm place. */
export default async function VisitPage() {
  const [site, copy] = await Promise.all([getSiteSettings(), getPageCopy('visit')]);
  const now = new Date();
  const open = getOpenState(site.hours.value, site.temporaryClosures, now, site.timeZone);
  const hours = groupHours(site.hours.value);

  return (
    <>
      <PageHero
        eyebrow={copy.eyebrow ?? pageCopy.visit.eyebrow}
        title={<EditorialTitle text={copy.heading} />}
        lede={copy.body ?? pageCopy.visit.body}
        asset="roomNight"
        assetTall="roomNightTall"
        focus={{ x: '52%', y: '74%' }}
        aside={
          <div className="grid gap-5">
            <p className="cn-chip" data-tone={open.open ? 'live' : undefined}>
              <span className="cn-dot" data-live={open.open} aria-hidden="true" /> {open.label}
            </p>
            <Link href={site.reservationUrl} className="cn-btn">
              Find your table <span className="cn-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        }
      />

      <MotionScope as="section" className="cn-night cn-section" aria-labelledby="where-title">
        <div className="cn-wrap cn-two-col">
          <div>
            <p className="cn-eyebrow" data-m="up">
              Where
            </p>
            <h2 id="where-title" className="cn-display cn-lg mt-4" data-m="title">
              A green door, <em>mid-block.</em>
            </h2>
            <address className="cn-lede mt-6 not-italic" data-m="up">
              {site.name} · {site.street}, {site.locality}
              <br />
              <span className="cn-body">A fictional address — the restaurant is imagined, the neighbourhood is real.</span>
            </address>
            <dl className="cn-arrive" data-m="stagger">
              {ARRIVING.map(([title, text]) => (
                <div key={title}>
                  <dt className="cn-eyebrow">{title}</dt>
                  <dd className="cn-body">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="cn-map-frame" data-m="up">
            <NeighborhoodMap />
          </div>
        </div>
      </MotionScope>

      <MotionScope as="section" className="cn-paper cn-grain cn-section" aria-labelledby="hours-title">
        <div className="cn-wrap cn-two-col">
          <div>
            <p className="cn-eyebrow" data-m="up">
              Hours
            </p>
            <h2 id="hours-title" className="cn-display cn-lg mt-4" data-m="title">
              Dinner nightly. <em>Late on weekends.</em>
            </h2>
            <dl className="cn-visit-hours cn-num mt-8" data-m="stagger">
              <div className="cn-visit-now">
                <dt className="cn-eyebrow">Right now</dt>
                <dd>{open.label}</dd>
              </div>
              {hours.map((group) => (
                <div key={group.label}>
                  <dt>{group.label}</dt>
                  <dd>{group.value}</dd>
                </div>
              ))}
            </dl>
            {site.temporaryClosures.length > 0 ? (
              <ul className="cn-body mt-6">
                {site.temporaryClosures.map((closure) => (
                  <li key={closure.id}>
                    <strong>{closure.date}</strong> — {closure.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <p className="cn-eyebrow" data-m="up">
              Before you come
            </p>
            <dl className="cn-service mt-6" data-m="stagger">
              {BEFORE.map(([title, text]) => (
                <div key={title}>
                  <dt className="cn-display cn-sm">{title}</dt>
                  <dd className="cn-body">{text}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 flex flex-wrap items-center gap-5" data-m="up">
              <a href={formatPhoneHref(site.phone.value)} className="cn-btn">
                Call {site.phone.value}
              </a>
              {site.email ? (
                <a href={`mailto:${site.email}`} className="cn-link">
                  {site.email}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </MotionScope>
      <ThemeWorld scene="welcome" />
    </>
  );
}
