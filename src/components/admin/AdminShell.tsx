import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/server/actions/team';
import type { Staff } from '@/server/auth';
import { canOpen, ROLE_LABEL, type Section } from '@/server/permissions';
import { AdminBottomBar, AdminNav, SectionTabs, type AdminNavItem } from './AdminNav';
import { SaveStatusProvider } from './SaveStatus';
import { Notice } from './ui';

/**
 * The admin shell.
 *
 * Seven sections — Events, Emails, Menu, Hubs, Look, Visit, Team — and every
 * earlier screen still within two taps: the door lives under Events, photos and
 * the seasonal look under Look, pages and enquiries under Visit. The owner's
 * name and the way out to the website sit on the right, quietly.
 *
 * Emails earned its own tab rather than a screen under Events: it is where
 * every template is looked at and where the optional ones are switched on and
 * off, and none of that is about a particular event.
 *
 * Everything a screen shares sits here rather than being repeated on each
 * page: the way back up a level, the link out to the real website, and the
 * single indicator that says a save worked.
 */

const NAV: (AdminNavItem & { section?: Section; ownerOnly?: boolean })[] = [
  {
    href: '/admin/events',
    label: 'Events',
    icon: 'events',
    section: 'events',
    also: ['/admin/scan', '/admin/customers'],
    screens: [
      { href: '/admin/events', label: 'Events' },
      { href: '/admin/door', label: 'Door' },
      { href: '/admin/customers', label: 'Customers' },
    ],
  },
  {
    href: '/admin/emails',
    label: 'Emails',
    icon: 'emails',
    section: 'events',
    screens: [
      { href: '/admin/emails', label: 'All emails' },
      { href: '/admin/emails/sending', label: 'Sending & log' },
    ],
  },
  { href: '/admin/menu', label: 'Menu', icon: 'menu', section: 'menu' },
  {
    href: '/admin/link-hubs',
    label: 'Hubs',
    icon: 'hubs',
    section: 'hubs',
  },
  {
    href: '/admin/look',
    label: 'Look',
    icon: 'look',
    section: 'website',
    screens: [
      { href: '/admin/look', label: 'Look' },
      { href: '/admin/theme', label: 'Seasonal look' },
      { href: '/admin/media', label: 'Photos & videos' },
    ],
  },
  {
    href: '/admin/hiring',
    label: 'People',
    icon: 'people',
    section: 'people',
    also: ['/admin/talent'],
    screens: [
      { href: '/admin/hiring', label: 'Applicants' },
      { href: '/admin/hiring/openings', label: 'Job openings' },
      { href: '/admin/talent', label: 'Talent' },
    ],
  },
  {
    href: '/admin/settings',
    label: 'Visit',
    icon: 'visit',
    section: 'settings',
    screens: [
      { href: '/admin/settings', label: 'Hours & contact' },
      { href: '/admin/website', label: 'Pages' },
      { href: '/admin/inquiries', label: 'Enquiries' },
    ],
  },
  {
    href: '/admin/team',
    label: 'Team',
    icon: 'team',
    ownerOnly: true,
    also: ['/admin/setup'],
    screens: [
      { href: '/admin/team', label: 'Accounts' },
      { href: '/staff/team', label: 'Employees' },
      { href: '/admin/setup', label: 'Setup' },
    ],
  },
];

export function AdminShell({
  staff,
  title,
  description,
  actions,
  /** The screen this one opened from, shown as a way back at the top. */
  backTo,
  local,
  children,
}: {
  staff: Staff;
  title: string;
  description?: string;
  actions?: ReactNode;
  backTo?: { href: string; label: string };
  /** True when edits are going to the local development file, not a real backend. */
  local: boolean;
  children: ReactNode;
}) {
  const items = NAV.filter((item) => {
    if (item.ownerOnly) return staff.role === 'owner';
    if (!item.section) return true;
    // Visit groups settings with pages and enquiries; anyone who may open any
    // of those sees the section, and each screen still checks its own access.
    if (item.section === 'settings') {
      return (
        canOpen({ role: staff.role, sections: staff.sections }, 'settings') ||
        canOpen({ role: staff.role, sections: staff.sections }, 'website')
      );
    }
    return canOpen({ role: staff.role, sections: staff.sections }, item.section);
  });
  const navItems = items.map(({ href, label, icon, also, screens }) => ({ href, label, icon, also, screens }));

  return (
    <SaveStatusProvider>
      <div className="cn-demo-bar"><span>Demo Workspace · No live payments or email</span><Link href="/demo/staff">Staff app</Link><Link href="/demo/manager">Schedule manager</Link><Link href="/">Restaurant</Link></div>
      <div className="min-h-dvh bg-ivory pb-20 lg:pb-0">
        <header className="sticky top-0 z-40 border-b border-night-text/10 bg-teal">
          <div className="mx-auto flex max-w-[1280px] items-center gap-x-6 px-4 py-2.5 sm:px-6">
            <Link href="/admin" className="display shrink-0 text-[1.375rem] leading-none text-night-text transition-opacity hover:opacity-80">
              Cosa Nostra
              <span className="ml-1.5 font-sans text-[0.75rem] font-medium normal-case tracking-[0.12em] text-night-text/55">
                admin
              </span>
            </Link>

            <AdminNav items={navItems} />

            <div className="ml-auto flex items-center gap-3 text-[0.8125rem]">
              {staff.source !== 'open' ? (
                <span className="hidden max-w-[12rem] truncate text-night-text/65 sm:block" title={`${staff.name || staff.email} · ${ROLE_LABEL[staff.role]}`}>
                  {firstName(staff.name || staff.email)}
                </span>
              ) : null}
              <Link
                href="/staff"
                className="hidden min-h-10 shrink-0 items-center gap-1 text-[0.875rem] font-semibold text-night-text/80 underline-offset-4 hover:text-night-text hover:underline sm:inline-flex"
                title="The employee app: schedule, team, training, tasks"
              >
                Staff app
              </Link>
              <Link
                href="/"
                target="_blank"
                className="inline-flex min-h-10 shrink-0 items-center gap-1 text-[0.875rem] font-semibold text-night-text/80 underline-offset-4 hover:text-night-text hover:underline"
              >
                View site
              </Link>
              {staff.source !== 'open' ? (
                <form action={signOut}>
                  <button type="submit" className="inline-flex min-h-10 items-center text-night-text/55 underline-offset-4 hover:text-night-text hover:underline">
                    Sign out
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </header>

        <main className="admin-settle mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
          {backTo || local ? (
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {backTo ? (
                <Link href={backTo.href} className="inline-flex min-h-10 items-center gap-1.5 text-[0.875rem] font-semibold text-brown-soft transition-colors hover:text-brown">
                  <span aria-hidden="true">←</span>
                  {backTo.label}
                </Link>
              ) : null}
              {local ? (
                <p className="rounded-full bg-brown/6 px-3 py-1.5 text-[0.8125rem] text-brown-soft">
                  Demo Workspace · Fictional data · Changes are temporary and private to this browser.
                </p>
              ) : null}
            </div>
          ) : null}

          <SectionTabs items={navItems} />

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h1 className="display text-[clamp(1.75rem,3vw,2.5rem)] leading-none text-brown">{title}</h1>
              {description ? (
                <p className="measure mt-2 text-[0.9375rem] leading-relaxed text-brown-soft">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>

          <div className="mt-6">{children}</div>
        </main>

        <AdminBottomBar items={navItems} />
      </div>
    </SaveStatusProvider>
  );
}

/** Contributors see this instead of a section they are not allowed to open. */
export function NoAccess({ what }: { what: string }) {
  return (
    <Notice tone="info">
      Your account does not have access to {what}. If you need it, ask the owner to add it to your
      account.
    </Notice>
  );
}

function firstName(who: string): string {
  return who.split(/[\s@]+/)[0] ?? who;
}
