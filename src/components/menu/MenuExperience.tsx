'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Menu, MenuSlug } from '@/content/types';
import { MenuSections } from './MenuSections';

const TAB_LABEL: Record<MenuSlug, string> = {
  food: 'Food',
  cocktails: 'Cocktails & Bar',
};

/**
 * Each mode carries an accent, so the visitor can see which menu they are in
 * without reading the label. One system, one accent per mode — the page is
 * not rebuilt per mode.
 *
 * Contrast, on the ivory reading surface, verified per pair:
 *   food      chile/coral fill with the near-black label — 4.72:1
 *   cocktails agave/teal fill with amber                 — 8.9:1
 */
const MODE: Record<MenuSlug, { fill: string; rule: string; link: string }> = {
  food: { fill: 'bg-coral text-on-orange', rule: 'bg-coral', link: 'hover:text-clay' },
  cocktails: { fill: 'bg-teal text-amber', rule: 'bg-teal', link: 'hover:text-agave' },
};

/**
 * One menu experience, two views.
 *
 * Food and Cocktails & Bar used to be separate routes, each with its own
 * full-page introduction — so comparing a antipasto to a martini meant two
 * page loads and reading two intros. They are one page with two modes.
 *
 * Behaviour that matters:
 *  - The hash is the state. `/menu#cocktails` selects a mode; `/menu#shareables`
 *    selects the mode that OWNS that category and scrolls to it, so the homepage
 *    can link straight at a section of the bar list.
 *  - Legacy `/menu/cocktails` and `/menu/brunch` redirect to those hashes, so no
 *    inbound link or indexed URL breaks.
 *  - Real tab semantics: roles, `aria-selected`, and arrow-key roving focus.
 *  - Every panel is rendered, with the inactive ones hidden — so browser
 *    find-in-page and "reader" tools still reach the whole menu, and switching
 *    is instant rather than a fetch.
 */
export function MenuExperience({
  menus,
  footNotes = {},
}: {
  menus: Menu[];
  /** Operational notes, rendered at the foot of the menu they apply to. */
  footNotes?: Partial<Record<MenuSlug, string>>;
}) {
  const slugs = useMemo(() => menus.map((menu) => menu.slug), [menus]);
  const [active, setActive] = useState<MenuSlug>('food');
  const tabsRef = useRef<HTMLDivElement>(null);
  // Read inside the hash listener without making it depend on render state.
  const activeRef = useRef<MenuSlug>('food');
  /** A category anchor that could not be scrolled to until its mode rendered. */
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);

  /** Which mode owns each category anchor. */
  const owner = useMemo(() => {
    const map = new Map<string, MenuSlug>();
    for (const menu of menus) {
      for (const category of menu.categories) map.set(category.id, menu.slug);
    }
    return map;
  }, [menus]);

  useEffect(() => {
    function apply(slug: MenuSlug) {
      activeRef.current = slug;
      setActive(slug);
    }

    function fromHash() {
      let hash = window.location.hash.replace('#', '');
      try { hash = decodeURIComponent(hash); } catch { /* Ignore malformed inbound hashes. */ }

      if (slugs.includes(hash as MenuSlug)) {
        apply(hash as MenuSlug);
        return;
      }

      const ownerSlug = owner.get(hash);
      if (ownerSlug) {
        // The browser cannot scroll to an anchor inside a hidden panel, so when
        // the mode has to change the scroll is deferred until the panel has
        // actually rendered — see the effect below.
        if (activeRef.current !== ownerSlug) setPendingAnchor(hash);
        apply(ownerSlug);
        return;
      }

      apply('food');
    }

    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [owner, slugs]);

  // Runs after the newly-selected panel has committed, so the anchor exists and
  // is no longer inside a `hidden` subtree.
  useEffect(() => {
    if (!pendingAnchor) return;
    document.getElementById(pendingAnchor)?.scrollIntoView();
    setPendingAnchor(null);
  }, [pendingAnchor, active]);

  function select(slug: MenuSlug) {
    activeRef.current = slug;
    setActive(slug);
    // replaceState, not a jump: switching modes should not scroll the page.
    window.history.replaceState(null, '', slug === 'food' ? '/menu' : `/menu#${slug}`);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const index = slugs.indexOf(active);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % slugs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + slugs.length) % slugs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = slugs.length - 1;
    else return;

    event.preventDefault();
    const slug = slugs[next]!;
    select(slug);
    tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${slug}"]`)?.focus();
  }

  const activeMenu = menus.find((menu) => menu.slug === active);
  const theme = MODE[active];

  return (
    <>
      <div className="sticky top-(--o-header-h) z-30 border-b border-brown/15 bg-ivory/95 backdrop-blur-[2px]">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-8 lg:px-12">
          {/* Primary: three equal segments, one control. Not one large pill
              followed by two loose text links. */}
          <div
            ref={tabsRef}
            role="tablist"
            aria-label="Menu"
            onKeyDown={onKeyDown}
            className="grid gap-1 rounded-(--radius-md) border border-brown/20 p-1 sm:max-w-lg"
            style={{ gridTemplateColumns: `repeat(${menus.length}, minmax(0, 1fr))` }}
          >
            {menus.map((menu) => {
              const selected = active === menu.slug;
              return (
                <button
                  key={menu.slug}
                  type="button"
                  role="tab"
                  data-tab={menu.slug}
                  id={`tab-${menu.slug}`}
                  aria-selected={selected}
                  aria-controls={`panel-${menu.slug}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(menu.slug)}
                  className={`inline-flex min-h-10 items-center justify-center rounded-(--radius-sm) px-2 text-center text-[0.8125rem] font-semibold leading-tight transition-colors sm:text-[0.9375rem] ${
                    selected
                      ? MODE[menu.slug].fill
                      : 'text-brown-soft hover:bg-brown/8 hover:text-brown'
                  }`}
                >
                  {TAB_LABEL[menu.slug]}
                </button>
              );
            })}
          </div>

          {/* Secondary: this mode's categories. Deliberately quieter than the
              mode control — small caps, no fill, no second tall band. */}
          {activeMenu && activeMenu.categories.length > 0 ? (
            <nav
              aria-label={`${TAB_LABEL[active]} categories`}
              className="-mx-1 flex gap-5 overflow-x-auto px-1 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {activeMenu.categories.map((category) => (
                <a
                  key={category.id}
                  href={`#${category.id}`}
                  className={`eyebrow shrink-0 whitespace-nowrap min-h-11 inline-flex items-center py-1 text-brown-soft transition-colors ${theme.link}`}
                >
                  {category.name}
                </a>
              ))}
            </nav>
          ) : (
            <div className="h-2" />
          )}
        </div>
        <div aria-hidden="true" className={`h-0.5 w-full ${theme.rule}`} />
      </div>

      {menus.map((menu) => (
        <div
          key={menu.slug}
          role="tabpanel"
          id={`panel-${menu.slug}`}
          aria-labelledby={`tab-${menu.slug}`}
          hidden={active !== menu.slug}
        >
          <MenuSections menu={menu} footNote={footNotes[menu.slug] ?? null} />
        </div>
      ))}
    </>
  );
}
