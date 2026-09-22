import Link from 'next/link';
import { ThemePhotoGuest } from '@/components/theme/ThemeWorld';
import { Asset } from '@/components/media/Asset';
import { Band, Frame } from '@/components/primitives/Band';
import { ButtonLink } from '@/components/primitives/Button';
import { Reveal } from '@/components/primitives/Reveal';
import { Eyebrow } from '@/components/primitives/Type';
import type { AssetId } from '@/content/assets';
import type { PageSection } from '@/content/types';

/**
 * TWO DOORS, because the menu has two rooms.
 *
 * This slot has been six tiles in a horizontal scroller, then four, and every
 * version had the same flaw: the categories overlapped, so the tile you picked
 * depended on how you happened to describe what you wanted. Antipasti sat beside
 * Plates when a antipasto dinner IS a plate. Martinis sat beside The bar when a
 * martini comes FROM the bar. A guest should never have to work out which of
 * two doors leads to the same room.
 *
 * The menu itself has exactly two rooms now that the brunch tab is gone — Food,
 * and Cocktails & Bar — so these are those two, big enough to be obvious and
 * impossible to confuse. Everything finer than that is one tap away on the menu
 * page, which is built for browsing in a way a homepage strip never is.
 */
type Door = {
  label: string;
  note: string;
  href: string;
  assetId: AssetId;
};

const DOORS: Door[] = [
  {
    label: 'Food',
    note: 'Handmade pasta, antipasti and generous Italian-American plates',
    href: '/menu#food',
    assetId: 'dishPasta',
  },
  {
    label: 'Cocktails & bar',
    note: 'Negronis, martinis, spritzes and the last glass of wine',
    href: '/menu#cocktails',
    assetId: 'houseNegroni',
  },
];

export function Offerings({ section }: { section: PageSection }) {
  if (!section.visible) return null;

  return (
    <Band surface="ivory" size="sm">
      <Frame wide>
        <Reveal>
          <div className="max-w-2xl">
            {section.eyebrow ? <Eyebrow tone="orange">{section.eyebrow}</Eyebrow> : null}
            <h2 className="display mt-2 text-[clamp(1.75rem,3vw,2.375rem)] text-brown">
              {section.heading}
            </h2>
            {section.body ? (
              <p className="measure mt-3 text-[0.9375rem] leading-relaxed text-brown-soft">
                {section.body}
              </p>
            ) : null}
          </div>
        </Reveal>

        <Reveal delay={60}>
          <ul className="mt-7 grid grid-cols-2 gap-3 sm:gap-5">
            {DOORS.map((door) => (
              <li key={door.label}>
                <Link href={door.href} className="group block">
                  <div className="relative isolate overflow-hidden rounded-(--radius-lg)">
                    <Asset
                      id={door.assetId}
                      className="aspect-[4/5] w-full sm:aspect-16/9"
                      sizes="(min-width: 640px) 46vw, 46vw"
                      rounded={false}
                    />
                    {/* Type over photography never relies on the photograph
                        being dark in the right place. */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-obsidian/90 to-transparent"
                    />
                    <p className="display absolute inset-x-0 bottom-0 p-4 text-[clamp(1.125rem,2.6vw,2rem)] leading-none text-night-text">
                      {door.label}
                    </p>
                  </div>
                  <p className="mt-2.5 text-[0.8125rem] leading-snug text-brown-soft transition-colors group-hover:text-clay sm:text-[0.875rem]">
                    {door.note}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* The companion stands in the open space BESIDE the button rather
            than on the artwork. Parked over a card she covered a third of the
            photograph and the end of its label, which is the one thing a
            category card exists to show. */}
        <Reveal delay={90}>
          <div className="relative mt-7 flex justify-start">
            <ButtonLink href="/menu">See the full menu</ButtonLink>
            <ThemePhotoGuest name="aperitivo" className="theme-photo-guest-beside" />
          </div>
        </Reveal>
      </Frame>
    </Band>
  );
}
