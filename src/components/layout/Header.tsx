import Image from 'next/image';
import Link from 'next/link';
import { getPublicAsset } from '@/content/media';
import { getSiteSettings } from '@/content/resolve';
import { MobileDrawer } from './MobileDrawer';
import { primaryNav } from './nav';


export async function Header() {
  const logo = await getPublicAsset('brandLogo');
  // Ordering and booking links come from settings, so changing one in the admin
  // changes every button on the site at once.
  const site = await getSiteSettings();

  return (
    <header className="sticky top-0 z-40 border-b border-brown/12 bg-ivory/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-(--o-header-h) max-w-[1600px] items-center gap-6 px-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center"
          aria-label={`${site.name} — home`}
        >
          {/* `sizes` in real pixels, because the slot is a real, known size:
              the wordmark is 28px tall (32 from `sm`), which at 1200:483 is
              70px wide, then 80px. Given that, the browser asks for a ~96px
              file on an ordinary screen and a ~256px one at 2x, instead of the
              384px one it was fetching for every visitor on every page.

              (`sizes` is only dangerous here if it is written as a viewport
              fraction; an explicit px value is what it is for.)

              The wordmark falls back to text rather than to a gap: a header with
              no way home is worse than a header with no logo. */}
          {logo?.path ? (
            <Image
              src={logo.path}
              alt={site.name}
              width={160}
              height={Math.round((160 * logo.height) / logo.width)}
              sizes="190px"
              priority
              className="h-auto w-[155px] sm:w-[190px]"
            />
          ) : (
            <span className="display text-[1.25rem] text-brown">{site.shortName}</span>
          )}
        </Link>

        <nav aria-label="Primary" className="hidden flex-1 lg:block">
          <ul className="flex items-center gap-8">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex h-(--o-header-h) items-center text-[0.9375rem] font-medium tracking-[0.01em] text-brown transition-colors hover:text-coral"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <a
            href={site.orderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden min-h-11 items-center rounded-(--radius-md) px-3 text-[0.9375rem] font-medium text-brown transition-colors hover:text-coral sm:inline-flex"
          >
            Order online
            <span className="sr-only">(opens Demo ordering in a new tab)</span>
          </a>
          <a
            href={site.reservationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden min-h-11 items-center rounded-(--radius-md) bg-coral px-5 text-[0.9375rem] font-semibold tracking-[0.02em] text-on-orange transition-colors hover:bg-coral-deep sm:inline-flex"
          >
            Reserve
            <span className="sr-only">(opens Demo ordering in a new tab)</span>
          </a>
          <MobileDrawer reservationUrl={site.reservationUrl} orderUrl={site.orderUrl} />
        </div>
      </div>
    </header>
  );
}
