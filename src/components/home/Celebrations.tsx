import Link from 'next/link';
import { Asset } from '@/components/media/Asset';
import { Frame } from '@/components/primitives/Band';
import { Reveal } from '@/components/primitives/Reveal';
import { ThemePhotoGuest, ThemeWorld } from '@/components/theme/ThemeWorld';


export function Celebrations() {
  return (
    <section
      className="o-band relative isolate bg-espresso on-dark py-(--spacing-band-sm)"
      aria-labelledby="celebrations-heading"
    >
      <Frame wide>
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
          <Reveal className="lg:col-span-6">
            {/* `mb-8` on the wrapper, not the inset tile: the tile overflows
                the room photo's own bottom edge by design (a real second
                photograph, not a sticker on top of the first one), and
                without it that overflow ran into the copy on mobile, where
                the two columns stack. */}
            <div className="relative mb-8 sm:mb-10">
              {/* Two companions, because this is the one section on the page
                  that is explicitly about making a fuss. */}
              <ThemePhotoGuest name="martini" />
              <Asset
                id="roomCrowd"
                className="aspect-[4/3] w-full"
                sizes="(min-width: 1024px) 46vw, 100vw"
              />
              {/* A second photograph, not a caption: the bartender who is
                  part of "the personal welcome" the copy already promises, tucked
                  into the opposite corner from the seasonal companion so
                  neither one is standing on the other. */}
              <div className="absolute -bottom-8 left-5 w-[34%] max-w-[150px] overflow-hidden rounded-(--radius-lg) shadow-[0_18px_32px_-12px_rgb(0_0_0/0.6)] ring-4 ring-espresso sm:-bottom-10 sm:left-8">
                <Asset
                  id="bartender"
                  className="aspect-square w-full"
                  sizes="(min-width: 1024px) 16vw, 34vw"
                  rounded={false}
                />
              </div>
            </div>
          </Reveal>

          <Reveal delay={70} className="lg:col-span-6">
            <p className="eyebrow text-amber">Birthdays & celebrations</p>
            <h2
              id="celebrations-heading"
              className="display mt-3 text-[clamp(1.75rem,3vw,2.375rem)] leading-[1.08] text-night-text"
            >
              Your people. Our place.
            </h2>
            {/* Every claim here is one the restaurant already publishes: the
                dessert, the song, the lights and the popper come from the
                approved celebrations copy. Capacities, minimums and room-hire
                terms are deliberately absent — they are not published anywhere,
                they depend on the date, and the inquiry form is what settles
                them. See src/app/(site)/private-events/page.tsx. */}
            <p className="measure mt-3 text-[0.9375rem] leading-relaxed text-night-soft">
              A birthday worth gathering for. A rehearsal dinner that becomes a memory. Intimate private dining, family-style menus and thoughtful service — from a table of eight to a full house.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/private-events"
                className="inline-flex min-h-12 items-center justify-center rounded-(--radius-md) bg-coral px-6 text-[0.9375rem] font-semibold tracking-[0.02em] text-on-orange transition-colors hover:bg-coral-deep"
              >
                Plan a celebration
              </Link>
              <Link
                href="/catering"
                className="inline-flex min-h-12 items-center justify-center rounded-(--radius-md) border border-night-text/35 px-6 text-[0.9375rem] font-semibold text-night-text transition-colors hover:border-amber hover:text-amber"
              >
                Catering packages
              </Link>
            </div>
          </Reveal>
        </div>
      </Frame>
      <ThemeWorld scene="music" />
    </section>
  );
}
