import Link from 'next/link';
import { NavIcon, type NavIconName } from '@/components/admin/icons';

/**
 * The five errands an owner runs from home, plus the one screen they put up
 * in the bar. Same tile as the rest of the admin's task links, with a
 * picture each so the thumb learns where they are.
 */

type Action = { href: string; title: string; icon: NavIconName | 'signage'; external?: boolean };

const ACTIONS: Action[] = [
  { href: '/admin/events/new', title: 'Add an event', icon: 'events' },
  { href: '/admin/menu', title: 'Update the menu', icon: 'menu' },
  { href: '/admin/link-hubs', title: 'Link hubs', icon: 'hubs' },
  { href: '/admin/media?upload=1', title: 'Add a photo or video', icon: 'photos' },
  { href: '/display', title: 'Open signage', icon: 'signage', external: true },
];

export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {ACTIONS.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          target={action.external ? '_blank' : undefined}
          className="admin-raised group flex min-h-14 items-center gap-3 rounded-(--radius-md) border border-brown/12 bg-linen px-4 py-3 transition-colors duration-150 hover:border-brown/30"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brown/8 text-brown">
            {action.icon === 'signage' ? <SignageIcon /> : <NavIcon name={action.icon} className="size-[18px]" />}
          </span>
          <span className="min-w-0 text-[0.9375rem] font-semibold text-brown">
            {action.title}
            {action.external ? (
              <span aria-hidden="true" className="ml-1 text-brown-soft">
                ↗
              </span>
            ) : null}
            {action.external ? <span className="sr-only"> (opens in a new tab)</span> : null}
          </span>
        </Link>
      ))}
    </nav>
  );
}

/** A screen on a stand: the TV in the bar. Drawn in the same hand as the nav icons. */
function SignageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 5h17v11h-17z" />
      <path d="M9 20.5h6" />
      <path d="M12 16v4.5" />
      <path d="m10.5 8.5 3.5 2-3.5 2z" />
    </svg>
  );
}
