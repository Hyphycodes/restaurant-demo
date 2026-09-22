import Link from 'next/link';
import type { Metadata } from 'next';
import { Celebrations } from '@/components/home/Celebrations';
import { FindUs } from '@/components/home/FindUs';
import { ActionRail, Hero } from '@/components/home/Hero';
import { FeaturedEvents } from '@/components/home/FeaturedEvents';
import { Offerings } from '@/components/home/Offerings';
import { ThemeWorld } from '@/components/theme/ThemeWorld';
import { seo } from '@/content/pages';
import { getSiteSettings } from '@/content/resolve';
import { getPublicEvents } from '@/server/content/events';
import { getPageCopy } from '@/server/content/pages';
import { selectHomepageEvents } from '@/lib/event-feature';
import { getOpenState } from '@/lib/hours';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({ ...seo.home!, path: '/' });

/**
 * Five minutes, not an hour.
 *
 * The homepage renders the next event date. With an hour-long window a cached
 * page can keep advertising a night that has already finished, which is precisely
 * what the August 15 audit found. The page is still statically served; the
 * staleness is just bounded to something shorter than a service.
 * See docs/EVENTS-FRESHNESS.md.
 */
export const dynamic = 'force-dynamic';



export default async function HomePage() {
  const now = new Date();
  const [settings, events, breadth, twoPaths] = await Promise.all([
    getSiteSettings(),
    getPublicEvents(),
    getPageCopy('home', 'breadth'),
    getPageCopy('home', 'two-paths'),
  ]);

  // One pass decides everything the homepage says about events: what is on
  // next, what leads the featured module, and whether a scheduled takeover is
  // running right now.
  const homepageEvents = selectHomepageEvents(events, now);
  const openState = getOpenState(
    settings.hours.value,
    settings.temporaryClosures,
    now,
    settings.timeZone,
  );

  return (
    <>
      {/* The soonest night of any series, not the first series' next night —
          "what's on" means tonight's Saturday, not next week's Friday. */}
      <Hero takeover={homepageEvents.takeover} />
      <ActionRail openLabel={openState.label} isOpen={openState.open} />
      {}
      <Offerings section={breadth} />
      {/* Seasonal scenes share the room with the content. */}
      <ThemeWorld scene="listening" />
      {/* The kitchen and the bar, formerly two bands. */}
      <FeaturedEvents events={homepageEvents} />
      {}
      <Celebrations />
      <FindUs section={twoPaths} />
      <section className="cn-portfolio"><div><p className="eyebrow">Behind the hospitality</p><h2>A restaurant. And everything behind it.</h2><p>This fictional supper club runs on a complete restaurant platform. Explore the content studio, event management and employee workspace with safe sample data.</p></div><nav aria-label="Explore the platform"><Link href="/demo/admin">Open admin demo ↗</Link><Link href="/demo/staff">Open staff demo ↗</Link></nav></section>
    </>
  );
}
