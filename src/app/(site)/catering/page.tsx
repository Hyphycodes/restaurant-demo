import { ThemeWorld } from '@/components/theme/ThemeWorld';
import type { Metadata } from 'next';
import { CateringForm } from '@/components/forms/CateringForm';
import { Band, Frame } from '@/components/primitives/Band';
import { ExternalButtonLink, ExternalTextLink } from '@/components/primitives/Button';
import { PageHeader } from '@/components/primitives/PageHeader';
import { Eyebrow } from '@/components/primitives/Type';
import { pageCopy, seo } from '@/content/pages';
import { getCateringItems, getCateringPackages, getSiteSettings } from '@/content/resolve';
import { getPageCopy } from '@/server/content/pages';

import { formatPriceRange } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({ ...seo.catering!, path: '/catering' });
export const revalidate = 3600;

/**
 * Catering.
 *
 * NO PRICE IS RENDERED ON THIS PAGE, by decision. Catering prices live on Demo ordering
 * and change there; a copy printed here goes stale the first time the kitchen
 * adjusts a tray, and a guest who plans around a stale number is a guest the
 * restaurant has to disappoint. The page sells the capability — what exists,
 * what is in it, how many it feeds — and Demo ordering is the single source of truth for
 * current packages and pricing.
 *
 * `formatPrice` is deliberately not imported here. Ordinary restaurant menu
 * prices are unaffected; this rule is about catering only.
 */

export default async function CateringPage() {
  const [packages, items, site, copy] = await Promise.all([
    getCateringPackages(),
    getCateringItems(),
    getSiteSettings(),
    getPageCopy('catering'),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={copy.eyebrow ?? undefined}
        heading={copy.heading}
        body={copy.body ?? undefined}
        actions={
          <ExternalButtonLink
            href={site.cateringOrderUrl}
            destination="Demo ordering ordering"
            size="lg"
          >
            View catering menu &amp; pricing on Demo ordering
          </ExternalButtonLink>
        }
      />

      {/* Packages as a full-width editorial table, not a card grid. */}
      <Band surface="linen">
        <Frame wide>
          <Eyebrow tone="orange">Party packages</Eyebrow>
          <ul className="mt-8 border-t-2 border-brown/25">
            {packages.map((pkg) => (
              <li key={pkg.id} className="border-b border-brown/15">
                <div className="grid gap-x-8 gap-y-3 py-7 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <h2 className="display text-[clamp(1.375rem,2vw,1.625rem)] text-brown">
                      {pkg.name}
                    </h2>
                    {pkg.servesMin ? (
                      <p className="tabular mt-2 text-[0.875rem] text-brown-soft">
                        Serves {formatPriceRange(pkg.servesMin, pkg.servesMax)}
                      </p>
                    ) : null}
                  </div>
                  <ul className="space-y-1 text-[0.9375rem] text-brown-soft sm:col-span-8">
                    {pkg.includes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="measure-lead text-[0.9375rem] leading-relaxed text-brown-soft">
              Current pricing for every package is on our Demo ordering catering page, where you can also
              place the order.
            </p>
            <ExternalTextLink
              href={site.cateringOrderUrl}
              destination="Demo ordering ordering"
              className="text-clay"
            >
              See package pricing
            </ExternalTextLink>
          </div>
        </Frame>
      </Band>

      <Band surface="cream">
        <Frame>
          <Eyebrow>By the tray</Eyebrow>
          <ul className="mt-8 columns-1 gap-x-12 sm:columns-2">
            {items.map((item) => (
              <li key={item.id} className="mb-5 break-inside-avoid border-b border-brown/12 pb-4">
                <h3 className="text-[0.9375rem] font-semibold text-brown">{item.name}</h3>
                {item.note ? (
                  <p className="mt-1.5 text-[0.875rem] leading-relaxed text-brown-soft">
                    {item.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          <p className="measure mt-6 text-[0.875rem] leading-relaxed text-brown-soft">
            {pageCopy.catering.note}
          </p>
        </Frame>
      </Band>

      <Band surface="sand" id="inquiry">
        <Frame>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <Eyebrow>Catering enquiry</Eyebrow>
              <h2 className="display mt-4 text-[clamp(1.5rem,2.4vw,1.875rem)] text-brown">
                Tell us what you need.
              </h2>
              <p className="measure mt-5 text-[0.9375rem] leading-relaxed text-brown">
                Send the date, the headcount, and roughly what you have in mind. Someone from Cosa Nostra
                will come back to you to confirm what we can do and what it costs.
              </p>
            </div>

            <div className="lg:col-span-7">
              <CateringForm
                phone={site.phone.value}
                packageNames={packages.map((p) => p.name)}
              />
            </div>
          </div>
        </Frame>
      </Band>
      <ThemeWorld scene="celebration" />
    </>
  );
}
