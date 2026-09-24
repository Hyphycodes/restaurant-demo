import Link from 'next/link';
import { Asset } from '@/components/media/Asset';
import type { Menu, MenuItem } from '@/content/types';
import { formatPrice } from '@/lib/format';
import { MotionScope } from '../motion/MotionScope';

/**
 * The kitchen, from the live menu.
 *
 * Whatever the admin marks as featured leads here; if nothing is, the first
 * plates of each course stand in. Unavailable dishes never make the cut.
 */
function pick(menus: Menu[], count: number): (MenuItem & { course: string })[] {
  const food = menus.find((menu) => menu.slug === 'food');
  const courses = (food?.categories ?? []).map((category) =>
    category.items.filter((item) => item.available).map((item) => ({ ...item, course: category.name })),
  );
  const featured = courses.flat().filter((item) => item.featured);
  const chosen = new Set(featured.map((item) => item.id));
  const picked = [...featured];
  // Then one plate per course, round-robin, so the list reads like a meal.
  for (let round = 0; picked.length < count && round < 10; round++) {
    for (const course of courses) {
      const next = course.find((item) => !chosen.has(item.id));
      if (next && picked.length < count) {
        picked.push(next);
        chosen.add(next.id);
      }
    }
  }
  return picked.slice(0, count);
}

export function Kitchen({ menus }: { menus: Menu[] }) {
  const plates = pick(menus, 5);

  return (
    <MotionScope as="section" className="cn-paper cn-grain cn-kitchen cn-section" aria-labelledby="kitchen-title">
      <div className="cn-wrap cn-kitchen-grid">
        <div className="cn-kitchen-copy">
          <p className="cn-eyebrow" data-m="up">
            La cucina
          </p>
          <h2 id="kitchen-title" className="cn-display cn-lg mt-5" data-m="title">
            Made by hand. <em>Meant to be shared.</em>
          </h2>
          <p className="cn-lede mt-6" data-m="up" data-delay="0.2">
            Pasta is rolled every afternoon and sauces start before lunch. The menu is short on purpose: the dishes we would
            fight you for, and a few that change with the market.
          </p>

          <ol className="cn-plates mt-10" data-m="stagger">
            {plates.map((item, index) => (
              <li key={item.id}>
                <span className="cn-plates-index cn-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="cn-plates-name">
                  {item.name}
                  {item.featured ? <span className="cn-plates-star"> House favourite</span> : null}
                  <small>
                    {item.course} — {item.description}
                  </small>
                </span>
                <span className="cn-plates-price cn-num">{item.priceCents != null ? formatPrice(item.priceCents) : 'MP'}</span>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-wrap gap-3" data-m="up">
            <Link href="/menu" className="cn-btn">
              Read the full menu <span className="cn-arrow" aria-hidden="true">→</span>
            </Link>
            <Link href="/menu#cocktails" className="cn-btn cn-btn-ghost">
              The bar
            </Link>
          </div>
        </div>

        <div className="cn-kitchen-media" aria-hidden="true">
          <div className="cn-photo cn-kitchen-a" data-m="image">
            <Asset id="pastaNight" rounded={false} sizes="(min-width: 900px) 40vw, 90vw" className="size-full" />
          </div>
          <div className="cn-kitchen-b-wrap" data-m="parallax" data-speed="0.35">
            <div className="cn-photo cn-kitchen-b" data-m="image" data-delay="0.25">
              <Asset id="burrataNight" rounded={false} sizes="(min-width: 900px) 22vw, 50vw" className="size-full" />
            </div>
          </div>
          <p className="cn-kitchen-caption cn-italic" data-m="up" data-delay="0.5">
            Sunday meatballs, every night of the week.
          </p>
        </div>
      </div>
    </MotionScope>
  );
}
