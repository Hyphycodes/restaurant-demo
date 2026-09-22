import Link from 'next/link';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { Band, Frame } from '@/components/primitives/Band';
import { ExternalButtonLink, ButtonLink } from '@/components/primitives/Button';
import { Display, Eyebrow } from '@/components/primitives/Type';
import { pageCopy } from '@/content/pages';
import { site } from '@/content/site';

const LINKS = [
  { href: '/menu', label: 'Food menu' },
  { href: '/menu#cocktails', label: 'Cocktails & bar' },
  { href: '/events', label: 'Events' },
  { href: '/catering', label: 'Catering' },
  { href: '/private-events', label: 'Private events' },
  { href: '/visit', label: 'Hours & directions' },
];

/**
 * 404. Centered composition is deliberate here — it is one of only two places on
 * the site where centering is allowed, because there is genuinely nothing else
 * on the page to compose against.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main">
        <Band surface="sand">
          <Frame>
            <div className="mx-auto max-w-xl text-center">
              <Eyebrow>404</Eyebrow>
              <Display as="h1" size="lg" className="mt-4 text-brown">
                {pageCopy.notFound.heading}
              </Display>
              <p className="mt-5 text-[length:var(--text-body-lg)] leading-relaxed text-brown">
                {pageCopy.notFound.body}
              </p>

              <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-3">
                {LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-11 items-center font-medium text-brown underline underline-offset-4 transition-[text-underline-offset] hover:underline-offset-[6px]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <ButtonLink href="/">Back to the homepage</ButtonLink>
                <ExternalButtonLink
                  href={site.reservationUrl}
                  destination="Demo ordering reservations"
                  variant="secondary"
                >
                  Reserve a table
                </ExternalButtonLink>
              </div>
            </div>
          </Frame>
        </Band>
      </main>
      <Footer />
    </>
  );
}
