import Link from 'next/link';
import type { ReactNode } from 'react';
import { activeAnnouncement, AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { ThemeWorldEdges } from '@/components/theme/ThemeWorld';
import { ThemeRoot } from '@/components/theme/ThemeRoot';
import { getAnnouncements, getSiteSettings } from '@/content/resolve';
import { JsonLd, restaurantJsonLd } from '@/lib/seo';
import type { ResolvedTheme } from '@/themes/types';

/**
 * Header, main and footer, wrapped in the active theme.
 *
 * Separate from the site layout so the admin's theme preview can render the
 * real public pages inside the real chrome with a theme forced on, rather than
 * a mock-up of them.
 */
export async function SiteChrome({ theme, children }: { theme: ResolvedTheme; children: ReactNode }) {
  const [announcements, settings] = await Promise.all([getAnnouncements(), getSiteSettings()]);
  const announcement = activeAnnouncement(announcements, new Date());

  return (
    <ThemeRoot theme={theme}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-(--radius-md) focus:bg-orange focus:px-4 focus:py-2.5 focus:font-semibold focus:text-on-orange"
      >
        Skip to main content
      </a>
      <div className="cn-demo-bar"><span>A fictional supper club. A real restaurant platform.</span><Link href="/demo/admin">Explore admin</Link><Link href="/demo/staff">Explore staff</Link></div>
      <AnnouncementBar announcement={announcement} />
      <Header />
      <main id="main">{theme.definition && theme.config.options.edges ? <ThemeWorldEdges /> : null}{children}</main>
      <Footer />
      <JsonLd data={restaurantJsonLd(settings)} />
    </ThemeRoot>
  );
}
