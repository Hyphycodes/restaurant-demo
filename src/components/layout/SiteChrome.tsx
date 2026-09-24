import type { ReactNode } from 'react';
import { Footer } from '@/components/aurelia/chrome/Footer';
import { Header } from '@/components/aurelia/chrome/Header';
import { Ribbon } from '@/components/aurelia/chrome/Ribbon';
import { SmoothScroll } from '@/components/aurelia/motion/SmoothScroll';
import { activeAnnouncement, AnnouncementBar } from '@/components/layout/AnnouncementBar';
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
      <div className="cn-site">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:bg-[color:var(--cn-candle)] focus:px-4 focus:py-2.5 focus:font-semibold focus:text-[color:var(--cn-ink)]"
        >
          Skip to main content
        </a>
        <Ribbon />
        <AnnouncementBar announcement={announcement} />
        <Header reservationUrl={settings.reservationUrl} phone={settings.phone.value} />
        <main id="main">
          {theme.definition && theme.config.options.edges ? <ThemeWorldEdges /> : null}
          {children}
        </main>
        <Footer />
        <SmoothScroll />
        <JsonLd data={restaurantJsonLd(settings)} />
      </div>
    </ThemeRoot>
  );
}
