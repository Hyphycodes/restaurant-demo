import type { Metadata } from 'next';
import { ApplyForm } from '@/components/forms/ApplyForm';
import { OpeningList } from '@/components/careers/OpeningList';
import { Asset } from '@/components/media/Asset';
import { Band, Frame } from '@/components/primitives/Band';
import { Reveal } from '@/components/primitives/Reveal';
import { Display, Eyebrow } from '@/components/primitives/Type';
import { ThemeWorld } from '@/components/theme/ThemeWorld';
import { MoreWays } from '@/components/visit/MoreWays';
import { pageCopy, seo } from '@/content/pages';
import { getSiteSettings } from '@/content/resolve';
import { formatPhoneHref } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';
import { getPublicOpenings } from '@/server/content/hiring';
import { getPageCopy, getPageList } from '@/server/content/pages';

export const metadata: Metadata = buildMetadata({ ...seo.careers!, path: '/careers' });


export default async function CareersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const [site, copy, perks, openings, params] = await Promise.all([
    getSiteSettings(),
    getPageCopy('careers'),
    getPageList('careers', 'perks'),
    getPublicOpenings(),
    searchParams,
  ]);

  const hiring = openings.length > 0;

  return (
    <>
      <Band surface="sand" size="sm">
        <Frame wide>
          <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
            <div className="lg:col-span-6">
              <Eyebrow>{copy.eyebrow ?? pageCopy.careers.eyebrow}</Eyebrow>
              <Display as="h1" size="xl" className="mt-3 text-brown">
                {copy.heading}
              </Display>
              <p className="measure-lead mt-6 text-[length:var(--text-body-lg)] leading-relaxed text-brown">
                {copy.body ?? pageCopy.careers.body}
              </p>
              <a
                href="#apply"
                className="mt-8 inline-flex min-h-12 items-center justify-center rounded-(--radius-md) bg-orange px-7 py-3.5 font-semibold tracking-[0.02em] text-on-orange transition-colors hover:bg-orange-deep"
              >
                {hiring ? 'Apply now' : 'Put your name in'}
              </a>
              <p className="mt-4 text-[0.875rem] text-brown">
                Rather talk to somebody? Call{' '}
                <a
                  href={formatPhoneHref(site.phone.value)}
                  className="tabular font-semibold underline underline-offset-4"
                >
                  {site.phone.value}
                </a>{' '}
                or stop in.
              </p>
            </div>
            {/* Stacked wide on a phone, a diptych from lg. Two full-width
                3:2 photographs beside a four-line heading left a hole the
                height of a screen above the words. */}
            <div className="grid grid-cols-2 gap-3 lg:col-span-5 lg:col-start-8 lg:gap-4">
              <Asset
                id="teamEnergy"
                className="col-span-2 aspect-3/2 w-full lg:col-span-1 lg:aspect-4/5"
                sizes="(min-width: 1024px) 20vw, 100vw"
                priority
              />
              <Asset
                id="roomAtmosphere"
                className="col-span-2 aspect-3/2 w-full lg:col-span-1 lg:aspect-4/5"
                sizes="(min-width: 1024px) 20vw, 100vw"
              />
            </div>
          </div>
        </Frame>
      </Band>

      {/* What is open, first. */}
      <Band surface="ivory" id="openings">
        <Frame wide>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 className="display text-[clamp(1.5rem,2.4vw,1.875rem)] text-brown">
              {hiring ? 'Open right now' : 'Nothing posted right now'}
            </h2>
            {hiring ? (
              <p className="text-[0.9375rem] text-brown-soft">
                {openings.length === 1 ? 'One role' : `${openings.length} roles`}
              </p>
            ) : null}
          </div>

          <div className="mt-6">
            {hiring ? (
              <OpeningList openings={openings} />
            ) : (
              <p className="measure rounded-(--radius-md) border border-dashed border-brown/25 px-5 py-6 text-[length:var(--text-body-lg)] leading-relaxed text-brown-soft">
                {pageCopy.work.empty}
              </p>
            )}
          </div>
        </Frame>
      </Band>

      {/* Then what it is actually like. */}
      <Band surface="cream">
        <Frame wide>
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-5">
                <Eyebrow tone="orange">{pageCopy.careers.energyHeading}</Eyebrow>
                <ul className="mt-6 space-y-2">
                  {perks.map((perk) => (
                    <li key={perk} className="display text-[clamp(1.5rem,2.4vw,1.875rem)] text-brown">
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-6 lg:col-start-7">
                <p className="measure text-[length:var(--text-body-lg)] leading-relaxed text-brown-soft">
                  {pageCopy.careers.energyBody}
                </p>
                <p className="eyebrow mt-8 text-clay">{pageCopy.careers.marquee}</p>
              </div>
            </div>
          </Reveal>
        </Frame>
      </Band>

      <Band surface="linen" id="apply">
        <Frame>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <Eyebrow>Apply</Eyebrow>
              <h2 className="display mt-4 text-[clamp(1.5rem,2.4vw,1.875rem)] text-brown">
                Two minutes. That is it.
              </h2>
              <p className="measure mt-5 text-[0.9375rem] leading-relaxed text-brown-soft">
                Name, number, when you can work. A résumé is welcome and never required — plenty of
                the crew started here with none. Somebody reads every one of these.
              </p>
            </div>

            <div className="lg:col-span-7">
              <ApplyForm
                phone={site.phone.value}
                openings={openings}
                defaultOpeningId={params.role}
              />
            </div>
          </div>
        </Frame>
      </Band>

      <MoreWays current="careers" />
      <ThemeWorld scene="welcome" />
    </>
  );
}
