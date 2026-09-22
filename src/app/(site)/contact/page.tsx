import type { Metadata } from 'next';
import Link from 'next/link';
import { OpeningList } from '@/components/careers/OpeningList';
import { Asset } from '@/components/media/Asset';
import { Band, Frame } from '@/components/primitives/Band';
import { ButtonLink } from '@/components/primitives/Button';
import { Reveal } from '@/components/primitives/Reveal';
import { Display, Eyebrow, Lead } from '@/components/primitives/Type';
import { ThemeWorld } from '@/components/theme/ThemeWorld';
import { LocationCard } from '@/components/visit/LocationCard';
import { MoreWays } from '@/components/visit/MoreWays';
import { pageCopy, seo } from '@/content/pages';
import { getSiteSettings } from '@/content/resolve';
import { TALENT_DISCIPLINES } from '@/content/talent';
import { buildMetadata } from '@/lib/seo';
import { buildVisitLocations } from '@/lib/visit';
import { getPublicOpenings } from '@/server/content/hiring';
import { getPageCopy } from '@/server/content/pages';

export const metadata: Metadata = buildMetadata({ ...seo.contact!, path: '/contact' });



// Hourly — the open/closed state changes through the day.
export const revalidate = 3600;

export default async function ContactPage() {
  const [site, copy, openings] = await Promise.all([
    getSiteSettings(),
    getPageCopy('contact'),
    getPublicOpenings(),
  ]);

  const locations = buildVisitLocations(site);
  const hiring = openings.length > 0;

  return (
    <>
      {/* 1 — Visit */}
      <Band surface="sand" size="sm">
        <Frame wide>
          <Eyebrow>{copy.eyebrow ?? pageCopy.contact.eyebrow}</Eyebrow>
          <Display as="h1" size="lg" className="mt-3 max-w-[16ch] text-brown">
            {copy.heading}
          </Display>
          <p className="measure-lead mt-4 text-[length:var(--text-body-lg)] leading-relaxed text-brown">
            {copy.body ?? pageCopy.contact.body}
          </p>

          <div className="mt-10">
            {locations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                priority
                showName={locations.length > 1}
              />
            ))}
          </div>
        </Frame>
      </Band>

      {}
      <Band surface="ivory">
        <Frame wide>
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-7">
                <Eyebrow tone="orange">{pageCopy.work.eyebrow}</Eyebrow>
                <Display as="h2" size="md" className="mt-3 text-brown">
                  {pageCopy.work.heading}
                </Display>
                <Lead className="mt-4">{pageCopy.work.body}</Lead>

                <div className="mt-7">
                  {hiring ? (
                    <OpeningList openings={openings} limit={3} />
                  ) : (
                    <p className="measure rounded-(--radius-md) border border-dashed border-brown/25 px-5 py-5 text-[0.9375rem] leading-relaxed text-brown-soft">
                      {pageCopy.work.empty}
                    </p>
                  )}
                </div>

                <div className="mt-7">
                  <ButtonLink href="/careers" size="lg">
                    {hiring ? 'See every opening' : 'Put your name in'}
                  </ButtonLink>
                </div>
              </div>

              <div className="lg:col-span-4 lg:col-start-9">
                <Asset
                  id="teamEnergy"
                  className="aspect-3/2 w-full"
                  sizes="(min-width: 1024px) 32vw, 100vw"
                />
              </div>
            </div>
          </Reveal>
        </Frame>
      </Band>

      {}
      <Band surface="plum">
        <Frame wide>
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-6">
                <Eyebrow tone="night">{pageCopy.talent.eyebrow}</Eyebrow>
                <Display as="h2" size="lg" className="mt-3 text-night-text">
                  {pageCopy.talent.heading}
                </Display>
                <Lead tone="night" className="mt-4">
                  {pageCopy.talent.body}
                </Lead>
                <div className="mt-8">
                  <Link
                    href="/talent"
                    className="inline-flex min-h-12 items-center justify-center rounded-(--radius-md) bg-orange px-7 text-base font-semibold tracking-[0.02em] text-on-orange transition-colors hover:bg-orange-deep"
                  >
                    Show us what you do
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 lg:col-start-8">
                <p className="eyebrow text-night-soft">{pageCopy.talent.disciplinesLead}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {TALENT_DISCIPLINES.filter((entry) => entry.id !== 'other').map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-full border border-night-text/25 px-3.5 py-1.5 text-[0.875rem] text-night-text"
                    >
                      {entry.label}
                    </li>
                  ))}
                </ul>
                <p className="measure mt-5 text-[0.875rem] leading-relaxed text-night-soft">
                  Not on the list? Tell us anyway — most of the best nights here started as
                  somebody&rsquo;s idea.
                </p>
              </div>
            </div>
          </Reveal>
        </Frame>
      </Band>

      <MoreWays current="contact" />
      <ThemeWorld scene="welcome" />
    </>
  );
}
