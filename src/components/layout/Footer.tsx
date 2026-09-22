import Link from 'next/link';
import { ThemeFooterLayer } from '@/components/theme/ThemeDivider';
import { getSiteSettings } from '@/content/resolve';
import { formatPhoneHref } from '@/lib/format';
import { primaryNav, secondaryNav } from './nav';

function SocialIcon({ platform }: { platform: string }) {
  const paths: Record<string, string> = {
    tiktok: 'M16.7 3c.3 2.3 1.6 3.7 3.8 3.9v3a8 8 0 0 1-3.8-1.1v6.1a6 6 0 1 1-5.2-5.9v3.1a3 3 0 1 0 2.2 2.8V3z',
    facebook:
      'M13.5 9V7.2c0-.7.2-1.2 1.3-1.2h1.4V3.6A18 18 0 0 0 14.2 3.5c-2 0-3.4 1.2-3.4 3.5V9H8.6v2.6h2.2V18h2.7v-6.4h2.2l.3-2.6z',
    instagram:
      'M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2m0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6M17 7.2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0M8 3.5h8A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16V8A4.5 4.5 0 0 1 8 3.5m0 1.7A2.8 2.8 0 0 0 5.2 8v8A2.8 2.8 0 0 0 8 18.8h8a2.8 2.8 0 0 0 2.8-2.8V8A2.8 2.8 0 0 0 16 5.2z',
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d={paths[platform] ?? ''} />
    </svg>
  );
}

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

export async function Footer() {
  const site = await getSiteSettings();
  // Computed, never typed. The live site still reads "© 2024".
  const year = new Date().getFullYear();

  return (
    <footer className="relative isolate overflow-hidden bg-plum text-night-text on-dark">
      <ThemeFooterLayer />
      <div className="relative mx-auto max-w-[1600px] px-5 py-12 sm:px-8 lg:px-12 lg:py-14">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-1">
            <p className="eyebrow text-night-soft">Find us</p>
            <address className="mt-4 not-italic leading-relaxed">
              <span className="block">{site.street}</span>
              <span className="block">
                {site.locality}, {site.region} {site.postalCode}
              </span>
            </address>
            <a
              href={site.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-11 items-center text-[0.9375rem] underline underline-offset-4 transition-[text-underline-offset] hover:underline-offset-[6px]"
            >
              Get directions
              <span className="sr-only">(opens Google Maps in a new tab)</span>
            </a>
            <a
              href={formatPhoneHref(site.phone.value)}
              className="mt-1 block min-h-11 pt-2.5 text-[0.9375rem] underline underline-offset-4"
            >
              {site.phone.value}
            </a>
          </div>

          <div>
            <p className="eyebrow text-night-soft">Explore</p>
            <ul className="mt-4 space-y-2 text-[0.9375rem]">
              {[...primaryNav, ...secondaryNav].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center underline-offset-4 transition-colors hover:text-orange hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow text-night-soft">Book & order</p>
            <div className="mt-4 grid gap-2">
              <a
                href={site.reservationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) bg-orange px-5 font-semibold text-on-orange transition-colors hover:bg-orange-deep"
              >
                Reserve a table
                <span className="sr-only">(opens Demo ordering in a new tab)</span>
              </a>
              <a
                href={site.orderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-(--radius-md) border border-night-text/30 px-5 font-semibold transition-colors hover:bg-night-text/10"
              >
                Order online
                <span className="sr-only">(opens Demo ordering in a new tab)</span>
              </a>
            </div>

            {}
            <ul className="mt-6 flex gap-2">
              {site.socials.map((social) => (
                <li key={social.platform}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex size-11 items-center justify-center rounded-full border border-night-text/25 transition-colors hover:border-orange hover:text-orange"
                  >
                    <SocialIcon platform={social.platform} />
                    <span className="sr-only">
                      {PLATFORM_LABEL[social.platform]} — {social.handle} (opens in a new tab)
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-night-text/15 pt-6 text-[0.8125rem] text-night-soft sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/legal/privacy" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
              Privacy
            </Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
