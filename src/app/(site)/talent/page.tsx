import type { Metadata } from 'next';
import { TalentForm } from '@/components/forms/TalentForm';
import { Asset } from '@/components/media/Asset';
import { Band, Frame } from '@/components/primitives/Band';
import { Reveal } from '@/components/primitives/Reveal';
import { Display, Eyebrow, Lead } from '@/components/primitives/Type';
import { ThemeWorld } from '@/components/theme/ThemeWorld';
import { MoreWays } from '@/components/visit/MoreWays';
import { pageCopy, seo } from '@/content/pages';
import { getSiteSettings } from '@/content/resolve';
import { TALENT_DISCIPLINES } from '@/content/talent';
import { buildMetadata } from '@/lib/seo';
import { getPageCopy } from '@/server/content/pages';

export const metadata: Metadata = buildMetadata({ ...seo.talent!, path: '/talent' });


export default async function TalentPage() {
  const [site, copy] = await Promise.all([getSiteSettings(), getPageCopy('talent')]);

  return (
    <>
      <Band surface="plum" size="sm">
        <Frame wide>
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
            <div className="lg:col-span-6">
              <Eyebrow tone="night">{copy.eyebrow ?? pageCopy.talent.eyebrow}</Eyebrow>
              <Display as="h1" size="xl" className="mt-3 text-night-text">
                {copy.heading}
              </Display>
              <Lead tone="night" className="mt-6">
                {copy.body ?? pageCopy.talent.body}
              </Lead>
              <a
                href="#share"
                className="mt-8 inline-flex min-h-12 items-center justify-center rounded-(--radius-md) bg-orange px-7 text-base font-semibold tracking-[0.02em] text-on-orange transition-colors hover:bg-orange-deep"
              >
                Show us what you do
              </a>
              <p className="mt-4 text-[0.875rem] text-night-soft">
                A sentence and a link is plenty. It takes about a minute.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:col-span-5 lg:col-start-8 lg:gap-4">
              <Asset
                id="roomCrowd"
                className="col-span-2 aspect-3/2 w-full"
                sizes="(min-width: 1024px) 40vw, 100vw"
                priority
                tone="dark"
              />
              {/* Both squares, so the mosaic has one straight bottom edge
                  rather than a ragged one. */}
              <Asset
                id="bartender"
                className="aspect-square w-full"
                sizes="(min-width: 1024px) 20vw, 50vw"
                tone="dark"
              />
              <Asset
                id="cocktailPair"
                className="aspect-square w-full"
                sizes="(min-width: 1024px) 20vw, 50vw"
                tone="dark"
              />
            </div>
          </div>
        </Frame>
      </Band>

      <Band surface="ivory">
        <Frame wide>
          <Reveal>
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-5">
                <Eyebrow tone="orange">{pageCopy.talent.disciplinesLead}</Eyebrow>
                <h2 className="display mt-4 text-[clamp(1.5rem,2.4vw,1.875rem)] text-brown">
                  If you make something, we want to see it.
                </h2>
                <p className="measure mt-5 text-[0.9375rem] leading-relaxed text-brown-soft">
                  Listening sessions, DJ sets, live music, comedy, photography, a wall that needs a
                  mural, a night nobody has run yet. We book local first — this is how you get on
                  the list.
                </p>
              </div>

              <div className="lg:col-span-6 lg:col-start-7">
                <ul className="flex flex-wrap gap-2">
                  {TALENT_DISCIPLINES.filter((entry) => entry.id !== 'other').map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-full border border-brown/25 bg-linen px-3.5 py-1.5 text-[0.875rem] text-brown"
                    >
                      {entry.label}
                    </li>
                  ))}
                </ul>
                <p className="measure mt-5 text-[0.9375rem] leading-relaxed text-brown-soft">
                  Not on the list? Send it anyway. Most of the best nights here started as
                  somebody&rsquo;s idea, not a category.
                </p>
              </div>
            </div>
          </Reveal>
        </Frame>
      </Band>

      <Band surface="linen" id="share">
        <Frame>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <Eyebrow>Tell us</Eyebrow>
              <h2 className="display mt-4 text-[clamp(1.5rem,2.4vw,1.875rem)] text-brown">
                Here&rsquo;s what I do.
              </h2>
              <p className="measure mt-5 text-[0.9375rem] leading-relaxed text-brown-soft">
                No bio, no proposal, no deck. Your name, what you do, and somewhere we can see it.
                Everything else on this form is optional and you can skip all of it.
              </p>
              <p className="measure mt-4 text-[0.875rem] leading-relaxed text-brown-soft">
                We read everything. If something fits a night we are planning, we will reach out.
              </p>
            </div>

            <div className="lg:col-span-7">
              <TalentForm phone={site.phone.value} />
            </div>
          </div>
        </Frame>
      </Band>

      <MoreWays current="talent" />
      <ThemeWorld scene="music" />
    </>
  );
}
