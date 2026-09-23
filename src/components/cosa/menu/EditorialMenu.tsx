import { Asset } from '@/components/media/Asset';
import type { Menu, MenuCategory, MenuItem } from '@/content/types';
import { formatPrice } from '@/lib/format';
import { MotionScope } from '../motion/MotionScope';
import { MenuIndex } from './MenuIndex';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const DIETARY: Record<string, { mark: string; label: string }> = {
  vegetarian: { mark: 'V', label: 'Vegetarian' },
  vegan: { mark: 'VG', label: 'Vegan' },
  'gluten-free-option': { mark: 'GF', label: 'Gluten-free on request' },
  spicy: { mark: '✺', label: 'Spicy' },
};

/** One photograph per course where the house has one; words carry the rest. */
const COURSE_IMAGE: Record<string, string> = {
  antipasti: 'burrataNight',
  pasta: 'pastaNight',
  cocktails: 'negroniPaper',
  'without-alcohol': 'barNight',
};

function Price({ item }: { item: MenuItem }) {
  if (item.priceCents != null) return <span className="cn-dish-price cn-num">{formatPrice(item.priceCents)}</span>;
  return <span className="cn-dish-price cn-dish-price-note">{item.priceNote ?? 'Ask your server'}</span>;
}

function Dish({ item }: { item: MenuItem & { imageAssetId?: string | null } }) {
  const extras = item.modifiers.filter((modifier) => modifier.priceCents != null);
  const choices = item.modifiers.filter((modifier) => modifier.priceCents == null);
  return (
    <li className="cn-dish" data-available={item.available} data-featured={item.featured}>
      {item.imageAssetId ? (
        <div className="cn-dish-photo cn-photo">
          <Asset id={item.imageAssetId} rounded={false} sizes="120px" className="size-full" />
        </div>
      ) : null}
      <div className="cn-dish-body">
        <div className="cn-dish-line">
          <h3 className="cn-dish-name">
            {item.name}
            {item.featured ? <span className="cn-dish-flag">✦ House favourite</span> : null}
            {!item.available ? <span className="cn-dish-flag cn-dish-flag-off">Not tonight</span> : null}
          </h3>
          <span className="cn-dish-leader" aria-hidden="true" />
          <Price item={item} />
        </div>
        {item.description ? <p className="cn-dish-desc">{item.description}</p> : null}
        {item.dietary.length > 0 || choices.length > 0 || extras.length > 0 ? (
          <p className="cn-dish-meta">
            {item.dietary.map((tag) => (
              <abbr key={tag} title={DIETARY[tag]?.label ?? tag} className="cn-diet">
                {DIETARY[tag]?.mark ?? tag}
              </abbr>
            ))}
            {choices.length > 0 ? (
              <span>
                {item.modifierGroupLabel ? `${item.modifierGroupLabel}: ` : ''}
                {choices.map((modifier) => modifier.label).join(' · ')}
              </span>
            ) : null}
            {extras.map((modifier) => (
              <span key={modifier.label}>
                {modifier.label} <span className="cn-num">+{formatPrice(modifier.priceCents!)}</span>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function Course({ category, index }: { category: MenuCategory; index: number }) {
  const image = COURSE_IMAGE[category.id];
  return (
    <MotionScope as="section" className="cn-course" id={category.id} aria-labelledby={`${category.id}-title`}>
      <header className="cn-course-head">
        <span className="cn-course-num" data-m="up">
          {ROMAN[index] ?? index + 1}
        </span>
        <h2 id={`${category.id}-title`} className="cn-display cn-course-title" data-m="title">
          {category.name}
        </h2>
        {category.note ? (
          <p className="cn-body" data-m="up">
            {category.note}
          </p>
        ) : null}
        {image ? (
          <div className="cn-course-photo cn-photo" data-m="image">
            <Asset id={image} rounded={false} sizes="(min-width: 1024px) 22vw, 60vw" className="size-full" />
          </div>
        ) : null}
      </header>
      <ul className="cn-dishes" data-m="stagger">
        {category.items.map((item) => (
          <Dish key={item.id} item={item} />
        ))}
      </ul>
    </MotionScope>
  );
}

export function EditorialMenu({ menus, footNotes }: { menus: Menu[]; footNotes: Partial<Record<string, string>> }) {
  let courseIndex = 0;
  const groups = menus.map((menu) => ({
    label: menu.slug === 'food' ? 'La cucina' : 'Il bar',
    items: menu.categories.map((category) => ({ id: category.id, name: category.name })),
  }));

  return (
    <div className="cn-paper cn-grain cn-menu-book">
      <div className="cn-wrap cn-menu-layout">
        <aside className="cn-menu-aside">
          <MenuIndex groups={groups} />
          <dl className="cn-menu-legend">
            {Object.values(DIETARY).map((entry) => (
              <div key={entry.mark}>
                <dt className="cn-diet">{entry.mark}</dt>
                <dd>{entry.label}</dd>
              </div>
            ))}
          </dl>
        </aside>
        <div className="cn-menu-main">
          {menus.map((menu) => (
            <div key={menu.slug} id={menu.slug} className="cn-menu-part">
              <header className="cn-menu-part-head">
                <p className="cn-eyebrow">{menu.slug === 'food' ? 'La cucina' : 'Il bar'}</p>
                <p className="cn-display cn-lg">
                  {menu.slug === 'food' ? (
                    <>
                      The kitchen, <em>until late.</em>
                    </>
                  ) : (
                    <>
                      Stirred, shaken, <em>poured slowly.</em>
                    </>
                  )}
                </p>
                {menu.note ? <p className="cn-body mt-4">{menu.note}</p> : null}
              </header>
              {menu.categories.length === 0 ? (
                <p className="cn-body">{menu.emptyState ?? 'This menu is being written. Ask your server tonight.'}</p>
              ) : (
                menu.categories.map((category) => <Course key={category.id} category={category} index={courseIndex++} />)
              )}
              {footNotes[menu.slug] ? <p className="cn-menu-foot">{footNotes[menu.slug]}</p> : null}
            </div>
          ))}
          <p className="cn-menu-foot">
            Please tell your server about allergies before you order; our kitchen handles nuts, gluten, dairy and shellfish.
            Cosa Nostra is fictional — dishes and prices are for this portfolio experience.
          </p>
        </div>
      </div>
    </div>
  );
}
