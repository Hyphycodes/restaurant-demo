'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StaffIcon, type StaffIconName } from './icons';

/**
 * Four things for an employee, five for a manager, and no dropdown.
 *
 * The version this replaced had a "Manage" mega-menu with ten entries
 * hanging off the bar, which meant a bartender's app advertised nine
 * systems they could not open. Management tools did not disappear: they
 * moved behind Operations, which is a screen rather than a menu, and a
 * screen can explain itself.
 *
 * Same bar top and bottom — the header on a desktop, a thumb bar on a
 * phone — so there is one thing to learn.
 */

export interface StaffNavItem {
  href: string;
  label: string;
  icon: StaffIconName;
  /** Other paths that count as inside this tab. */
  also?: string[];
  badge?: number;
}

function inside(pathname: string, item: { href: string; also?: string[] }): boolean {
  const roots = [item.href, ...(item.also ?? [])];
  if (item.href === '/staff') return pathname === '/staff' || (item.also ?? []).some((root) => pathname === root || pathname.startsWith(`${root}/`));
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`) || pathname.startsWith(`${root}?`));
}

export function StaffBottomBar({ items }: { items: StaffNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Staff app"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-night-text/12 bg-teal/95 backdrop-blur-sm lg:hidden"
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
                className={`relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors ${active ? 'text-amber' : 'text-night-text/70'}`}
              >
                <StaffIcon name={item.icon} className="size-[24px]" />
                {item.label}
                {item.badge ? (
                  <span className="absolute left-1/2 top-2 ml-1.5 min-w-4 rounded-full bg-coral px-1 text-center text-[0.625rem] font-bold leading-4 text-on-orange">{item.badge > 9 ? '9+' : item.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function StaffTopNav({ items }: { items: StaffNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Staff app" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = inside(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative inline-flex min-h-11 items-center gap-1.5 px-3 text-[0.9375rem] font-semibold transition-colors ${active ? 'text-night-text' : 'text-night-text/70 hover:text-night-text'}`}
              >
                {item.label}
                {item.badge ? <span className="min-w-4 rounded-full bg-coral px-1 text-center text-[0.625rem] font-bold leading-4 text-on-orange">{item.badge}</span> : null}
                {active ? <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-amber" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
