import { Frame } from '@/components/primitives/Band';
import type { Menu, MenuItem } from '@/content/types';
import { formatPrice } from '@/lib/format';

const DIETARY_LABEL: Record<string, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'gluten-free-option': 'Gluten-free option',
  spicy: 'Spicy',
};

function Price({ item }: { item: MenuItem }) {
  if (item.priceCents != null) {
    return (
      <p className="tabular shrink-0 text-[1.0625rem] font-semibold text-brown">
        {formatPrice(item.priceCents)}
      </p>
    );
  }

  // A missing base price is stated plainly. It is never rendered as $0 and never
  // silently omitted. See docs/CONTENT-QUESTIONS.md §3.
  return (
    <p className="shrink-0 text-[0.8125rem] font-medium text-brown-soft">
      {item.priceNote ?? 'Ask your server'}
    </p>
  );
}

function Item({ item }: { item: MenuItem }) {
  const priced = item.modifiers.filter((m) => m.priceCents != null);
  const choices = item.modifiers.filter((m) => m.priceCents == null);

  return (
    <li
      // break-inside-avoid keeps a dish, its description and its modifiers in one
      // piece when the list flows into the second column.
      className={`mb-5 break-inside-avoid border-b border-brown/12 pb-5 lg:mb-6 lg:pb-6 ${
        item.available ? '' : 'opacity-60'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
        <h3 className="text-[1.0625rem] font-semibold leading-snug text-brown">
          {item.name}
          {!item.available ? (
            <span className="ml-2 align-middle text-[0.75rem] font-medium text-warning">
              Currently unavailable
            </span>
          ) : null}
        </h3>
        <Price item={item} />
      </div>

      {item.description ? (
        <p className="mt-1 text-[0.875rem] leading-relaxed text-brown-soft">{item.description}</p>
      ) : null}

      {item.dietary.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {item.dietary.map((tag) => (
            <li
              key={tag}
              className="rounded-(--radius-sm) border border-brown/20 px-2 py-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-brown-soft"
            >
              {DIETARY_LABEL[tag] ?? tag}
            </li>
          ))}
        </ul>
      ) : null}

      {choices.length > 0 ? (
        <p className="mt-2 text-[0.8125rem] text-brown-soft">
          {item.modifierGroupLabel ? (
            <span className="font-medium text-brown">{item.modifierGroupLabel}: </span>
          ) : null}
          {choices.map((m) => m.label).join(' · ')}
        </p>
      ) : null}

      {priced.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.8125rem] text-brown-soft">
          {priced.map((m) => (
            <li key={m.label} className="tabular">
              {m.label} <span className="text-brown">+{formatPrice(m.priceCents!)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * The categories and rows for one menu.
 *
 * Desktop runs two columns inside a controlled measure, because one column of
 * short dish names down the left of a 1440px page left the prices stranded
 * halfway across an empty field. CSS multi-column — not masonry — is what does
 * it: the reading order stays exactly the DOM order (down column one, then down
 * column two, the way a printed menu reads) and the browser balances the height,
 * so no category ends with one full column beside an empty one.
 *
 * Modifiers render as compressed inline runs rather than full-width rows with the
 * same weight as dishes, so a 40-item menu reads as 40 items and not as 90.
 */
export function MenuSections({ menu, footNote }: { menu: Menu; footNote?: string | null }) {
  if (menu.categories.length === 0) {
    return (
      <Frame>
        <div className="py-(--spacing-band-sm)">
          {menu.note ? (
            <p className="eyebrow text-clay">{menu.note}</p>
          ) : null}
          <p className="measure mt-4 text-[length:var(--text-body-lg)] leading-relaxed text-brown-soft">
            {menu.emptyState}
          </p>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="pb-(--spacing-band)">
        {menu.note ? (
          <p className="eyebrow pt-6 text-clay">{menu.note}</p>
        ) : null}

        {menu.categories.map((category) => (
          <section
            key={category.id}
            id={category.id}
            aria-labelledby={`${category.id}-heading`}
            // The sticky menu navigation must not cover the heading it jumps to.
            className="scroll-mt-[calc(var(--o-header-h)+7rem)] pt-10 first:pt-7 lg:pt-14"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-brown/25 pb-3">
              <h2
                id={`${category.id}-heading`}
                className="display text-[clamp(1.375rem,2vw,1.625rem)] text-brown"
              >
                {category.name}
              </h2>
              {category.note ? (
                <p className="text-[0.875rem] text-brown-soft">{category.note}</p>
              ) : null}
            </div>
            {/* Two columns from 768 up. Below that a single column is the only
                honest option; above it, one column leaves a short dish name at
                the left of the measure and its price stranded at the far right. */}
            <ul className="mt-5 gap-x-10 md:columns-2 lg:gap-x-14">
              {category.items.map((item) => (
                <Item key={item.id} item={item} />
              ))}
            </ul>
          </section>
        ))}

        {/* Operational notes sit at the foot of the one menu they concern, not in
            front of every visitor before they have seen a dish. */}
        {footNote ? (
          <p className="measure mt-8 border-t border-brown/15 pt-5 text-[0.875rem] leading-relaxed text-brown-soft">
            {footNote}
          </p>
        ) : null}
      </div>
    </Frame>
  );
}
