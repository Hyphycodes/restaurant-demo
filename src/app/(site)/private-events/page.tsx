import { ThemeWorld } from '@/components/theme/ThemeWorld';
import type { Metadata } from 'next';
import { getSiteSettings } from '@/content/resolve';
import { getPageCopy, getPageList } from '@/server/content/pages';
import { PrivateEventForm } from '@/components/forms/PrivateEventForm';
import { Asset } from '@/components/media/Asset';
import { Band, Frame } from '@/components/primitives/Band';
import { PageHeader } from '@/components/primitives/PageHeader';
import { Eyebrow } from '@/components/primitives/Type';
import { birthdayCelebration } from '@/content/catering';
import { seo } from '@/content/pages';

import { formatPrice } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  ...seo.privateEvents!,
  path: '/private-events',
});


export default async function PrivateEventsPage() {
  // Address, phone and links come from settings, so an edit in the admin
  // reaches every page rather than only the ones somebody remembered.
  const [site, copy, eventTypes] = await Promise.all([
    getSiteSettings(),
    getPageCopy('private-events'),
    getPageList('private-events', 'types'),
  ]);
  return (
    <>
      <PageHeader
        surface="sand"
        eyebrow={copy.eyebrow ?? undefined}
        heading={copy.heading}
        body={copy.body ?? undefined}
      />

      <Band surface="cream">
        <Frame wide>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <Asset
                id="birthdayCelebration"
                className="aspect-4/5 w-full"
                sizes="(min-width: 1024px) 40vw, 100vw"
              />
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <Eyebrow tone="orange">The Birthday Celebration</Eyebrow>
              <h2 className="display mt-4 text-[clamp(1.5rem,2.4vw,1.875rem)] text-brown">
                We do birthdays properly.
              </h2>
              <ul className="mt-7 space-y-3 border-t border-brown/15 pt-6">
                {birthdayCelebration.includes.map((line) => (
                  <li key={line} className="flex gap-3 text-[0.9375rem] leading-relaxed text-brown">
                    <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-orange" />
                    {line}
                  </li>
                ))}
              </ul>

              <dl className="mt-7 border-t border-brown/15 pt-6">
                <dt className="eyebrow text-brown-soft">Add champagne</dt>
                <dd className="mt-3 space-y-2">
                  {birthdayCelebration.addOns.map((addOn) => (
                    <span key={addOn.label} className="flex justify-between gap-4 text-[0.9375rem]">
                      <span className="text-brown">{addOn.label}</span>
                      <span className="tabular font-semibold text-brown">
                        {formatPrice(addOn.priceCents)}
                      </span>
                    </span>
                  ))}
                </dd>
              </dl>

              <p className="measure mt-6 text-[0.875rem] leading-relaxed text-brown-soft">
                Ask your server when you book and the team will set it up.
              </p>
            </div>
          </div>
        </Frame>
      </Band>

      <Band surface="linen" id="inquiry">
        <Frame>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <Eyebrow>Event enquiry</Eyebrow>
              <h2 className="display mt-4 text-[clamp(1.5rem,2.4vw,1.875rem)] text-brown">
                Send us the details.
              </h2>
              <p className="measure mt-5 text-[0.9375rem] leading-relaxed text-brown-soft">
                We do not publish room capacities or minimums online because they depend on the
                night and the size of your group. Tell us what you are planning and someone from
                Cosa Nostra will come back to you with what is possible.
              </p>
            </div>

            <div className="lg:col-span-7">
              <PrivateEventForm phone={site.phone.value} eventTypes={eventTypes} />
            </div>
          </div>
        </Frame>
      </Band>
      <ThemeWorld scene="music" />
    </>
  );
}
