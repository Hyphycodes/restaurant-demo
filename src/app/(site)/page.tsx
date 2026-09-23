import type { Metadata } from 'next';
import { Evening } from '@/components/cosa/home/Evening';
import { Hero } from '@/components/cosa/home/Hero';
import { Kitchen } from '@/components/cosa/home/Kitchen';
import { Nights } from '@/components/cosa/home/Nights';
import { Overture } from '@/components/cosa/home/Overture';
import { Rooms } from '@/components/cosa/home/Rooms';
import { VisitBand } from '@/components/cosa/home/Visit';
import { Behind } from '@/components/cosa/platform/Behind';
import { getPlatformSnapshot } from '@/components/cosa/platform/snapshot';
import { ThemeWorld } from '@/components/theme/ThemeWorld';
import { seo } from '@/content/pages';
import { getAllMenus, getSiteSettings } from '@/content/resolve';
import { selectHomepageEvents } from '@/lib/event-feature';
import { getOpenState } from '@/lib/hours';
import { buildMetadata } from '@/lib/seo';
import { getPublicEvents } from '@/server/content/events';

export const metadata: Metadata = buildMetadata({ ...seo.home!, path: '/' });

/**
 * Rendered per request: the hero says whether the doors are open and what is
 * on next, and a cached page would keep advertising a night that has passed.
 */
export const dynamic = 'force-dynamic';

/**
 * The homepage is the beginning of an evening, in order: arriving, the first
 * drink, dinner, the second act, the back room — and then the doors behind
 * the bar open onto the system that runs it all.
 */
export default async function HomePage() {
  const now = new Date();
  const [settings, events, menus, snapshot] = await Promise.all([
    getSiteSettings(),
    getPublicEvents(),
    getAllMenus(),
    getPlatformSnapshot(),
  ]);

  const homepageEvents = selectHomepageEvents(events, now);
  const nights = [homepageEvents.lead, ...homepageEvents.supporting].filter((event) => event !== null);
  const openState = getOpenState(settings.hours.value, settings.temporaryClosures, now, settings.timeZone);

  return (
    <>
      <Hero
        reservationUrl={settings.reservationUrl}
        openLabel={openState.label}
        isOpen={openState.open}
        next={homepageEvents.takeover ?? homepageEvents.next}
      />
      <Overture />
      <Evening />
      <Kitchen menus={menus} />
      <Nights events={nights} />
      <ThemeWorld scene="listening" />
      <Rooms />
      <Behind snapshot={snapshot} id="behind-the-hospitality" />
      <VisitBand site={settings} openLabel={openState.label} isOpen={openState.open} />
    </>
  );
}
