import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Archivo } from 'next/font/google';
import { site } from '@/content/site';
import { seo } from '@/content/pages';
import { SITE_URL } from '@/lib/seo';
import { AppearanceStyle } from '@/components/appearance/AppearanceStyle';
import { AppearancePreviewListener } from '@/components/appearance/AppearancePreviewListener';
import { getAppearance } from '@/server/appearance';
import './globals.css';

/**
 * Archivo, variable, with BOTH the weight and width axes.
 *
 * The width axis is what lets display type be genuinely expanded rather than
 * faux-stretched — see docs/DESIGN-DIRECTION.md §2.2 for why this substitutes for
 * the site's licensed `aether` / `neue-haas-unica-pro` pairing. One family, one
 * download, `display: swap` so text is never invisible while it loads.
 */
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
});

/**
 * Anton — the display voice. Condensed, heavy, poster-scale.
 *
 * One weight, used only for marquee statements, event posters and After Dark,
 * so it stays a deliberate voice rather than a second body font. `display: swap`
 * means a slow font never blocks the headline from rendering.
 */
const anton = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-anton',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: seo.home!.title,
    template: `%s`,
  },
  description: seo.home!.description,
  applicationName: site.name,
  authors: [{ name: site.name }],
  creator: site.name,
  formatDetection: { telephone: true, address: true },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  themeColor: '#211a17',
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The look is a database row, cached for a minute and revalidated on save.
  // It is emitted here, in the head, so the first paint is already right.
  const appearance = await getAppearance();
  return (
    <html lang="en" className={`${archivo.variable} ${anton.variable}`}>
      <head>
        <AppearanceStyle appearance={appearance} />
      </head>
      <body>
        <AppearancePreviewListener />
        {children}
      </body>
    </html>
  );
}
