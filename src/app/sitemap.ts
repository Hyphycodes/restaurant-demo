import type { MetadataRoute } from 'next';
import { getPublicEvents } from '@/server/content/events';
import { buildCalendar } from '@/lib/event-calendar';
import { absoluteUrl } from '@/lib/seo';
import { listSearchableHubSlugs } from '@/server/content/link-hubs';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [input, hubSlugs] = await Promise.all([getPublicEvents(), listSearchableHubSlugs()]);
  const { series } = input;

  const staticRoutes: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/menu', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/events', priority: 0.9, changeFrequency: 'daily' },
    { path: '/catering', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/private-events', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/visit', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/contact', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/careers', priority: 0.5, changeFrequency: 'weekly' },
    { path: '/talent', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/legal/privacy', priority: 0.2, changeFrequency: 'monthly' },
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    // Archived or paused series drop out of the sitemap automatically, because
    // the loader has already filtered them.
    ...series.filter((entry) => !entry.paused && !entry.archivedAt).map((entry) => ({
      url: absoluteUrl(`/events/${entry.slug}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    // Special events, each of which has its own page. Only what is still to
    // come: a finished event's page still resolves for anyone holding a link to
    // it, but there is no reason to keep asking search engines to crawl it.
    ...buildCalendar(input, now)
      .months.flatMap((month) => month.events)
      .filter((event) => event.slug)
      .map((event) => ({
        url: absoluteUrl(`/events/${event.slug}`),
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })),
    ...hubSlugs.map((slug) => ({
      url: absoluteUrl(`/go/${slug}`),
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
  ];
}
