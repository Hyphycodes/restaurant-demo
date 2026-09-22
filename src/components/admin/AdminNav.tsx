'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon, type NavIconName } from './icons';

/**
 * The primary admin sections.
 *
 * On a desktop they sit in the header with a small amber underline on the
 * one you are in — not a filled pill, so the accent stays for actions. On a
 * phone the same five become a bottom bar of icons, where a thumb can reach
 * them behind the bar. A section with more than one screen shows those
 * screens as a quiet row of tabs under the page title.
 */

export interface AdminNavItem {
  href: string;
  label: string;
  icon: NavIconName;
  /** Other paths that count as "inside" this section. */
  also?: string[];
  /** The screens in this section, shown as sub-tabs when there is more than one. */
  screens?: { href: string; label: string }[];
}

function inside(pathname: string, item: AdminNavItem): boolean {
  const roots = [item.href, ...(item.also ?? []), ...(item.screens ?? []).map((screen) => screen.href)];
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`) || pathname.startsWith(`${root}?`));
}

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = inside(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative inline-flex min-h-11 items-center gap-1.5 px-3 text-[0.9375rem] font-semibold transition-colors ${
                  active ? 'text-night-text' : 'text-night-text/70 hover:text-night-text'
                }`}
              >
                {item.label}
                {active ? (
                  <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-amber" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The primary section icons a thumb reaches on a phone. */
export function AdminBottomBar({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-night-text/12 bg-teal/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto flex max-w-[640px] items-stretch justify-around">
        {items.map((item) => {
          const active = inside(pathname, item);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold ${
                  active ? 'text-amber' : 'text-night-text/70'
                }`}
              >
                <NavIcon name={item.icon} className="size-[22px]" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The screens inside the current section, when there is more than one. */
export function SectionTabs({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const section = items.find((item) => inside(pathname, item));
  const screens = section?.screens ?? [];
  if (screens.length < 2) return null;
  return (
    <nav aria-label={`${section!.label} screens`} className="-mx-1 mb-5">
      <ul className="flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {screens.map((screen) => {
          const active = pathname === screen.href || pathname.startsWith(`${screen.href}/`);
          return (
            <li key={screen.href}>
              <Link
                href={screen.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-[0.9375rem] font-semibold transition-colors ${
                  active ? 'border-amber text-brown' : 'border-transparent text-brown-soft hover:text-brown'
                }`}
              >
                {screen.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
