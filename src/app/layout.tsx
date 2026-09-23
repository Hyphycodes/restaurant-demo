import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { site } from '@/content/site';
import { seo } from '@/content/pages';
import { SITE_URL } from '@/lib/seo';
import { AppearanceStyle } from '@/components/appearance/AppearanceStyle';
import { AppearancePreviewListener } from '@/components/appearance/AppearancePreviewListener';
import { getAppearance } from '@/server/appearance';
import './globals.css';

// Locally bundled, openly licensed typefaces keep builds independent of font APIs.
const archivo = localFont({src:'./fonts/archivo.woff2',weight:'100 900',display:'swap',variable:'--font-archivo'});
const anton = localFont({src:'./fonts/cormorant.woff2',weight:'300 700',display:'swap',variable:'--font-anton'});
// Bodoni Moda: an Italian didone for the public site's display voice, with a true italic.
const bodoni = localFont({
  src: [
    { path: './fonts/bodoni-moda.woff2', weight: '400 900', style: 'normal' },
    { path: './fonts/bodoni-moda-italic.woff2', weight: '400 900', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-bodoni',
});

/**
 * Motion is progressive. This runs before first paint: only when JavaScript is
 * running and the visitor has not asked for reduced motion does the page hide
 * the elements GSAP is about to bring in. If the motion engine has not started
 * within four seconds, everything is shown as-is.
 */
const MOTION_BOOT = `(function(){try{var d=document.documentElement;if(!matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('cn-js');setTimeout(function(){if(!window.__cnMotion)d.classList.add('cn-motion-failsafe')},4000)}}catch(e){}})();`;

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
    <html lang="en" className={`${archivo.variable} ${anton.variable} ${bodoni.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT }} />
        <AppearanceStyle appearance={appearance} />
      </head>
      <body>
        <AppearancePreviewListener />
        {children}
      </body>
    </html>
  );
}
