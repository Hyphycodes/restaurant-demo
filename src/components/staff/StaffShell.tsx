import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/server/actions/team';
import { SaveStatusProvider } from '@/components/admin/SaveStatus';
import { OPS_ROLE_LABEL } from '@/content/staff-types';
import type { StaffContext } from '@/server/staff/session';
import { contextCan } from '@/server/staff/session';
import { StaffIcon } from './icons';
import { PreviewBanner } from './PreviewBanner';
import { StaffBottomBar, StaffTopNav, type StaffNavItem } from './StaffNav';

/**
 * The frame of the staff app.
 *
 * One header — the wordmark, where you are, notifications, sign out — and
 * one bar of four or five destinations. A screen's own title is rendered by
 * the screen, so the frame never has to know what it is holding.
 *
 * The bar is built from capabilities, not from a role name, so an account
 * that gains scheduling gains the tab in the same moment.
 */
export function StaffShell({ context, unread = 0, children, wide = false }: { context: StaffContext; unread?: number; children: ReactNode; wide?: boolean }) {
  const manages = contextCan(context, 'schedule.view_team');
  const items: StaffNavItem[] = [
    { href: '/staff', label: 'Home', icon: 'home', also: ['/staff/notifications', '/staff/announcements', '/staff/checklists', '/staff/tasks'] },
    { href: '/staff/schedule', label: 'Schedule', icon: 'schedule', also: ['/staff/time-off', '/staff/availability'] },
  ];
  if (manages) items.push({ href: '/staff/team', label: 'Team', icon: 'team' });
  items.push({ href: '/staff/training', label: 'Training', icon: 'training' });
  if (manages) items.push({ href: '/staff/operations', label: 'Operations', icon: 'operations', also: ['/staff/events', '/staff/contractors', '/staff/incidents', '/staff/locations', '/staff/search'] });
  else items.push({ href: '/staff/profile', label: 'Profile', icon: 'profile', also: ['/staff/documents', '/staff/onboarding'] });

  return (
    <SaveStatusProvider>
      <div className="cn-demo-bar"><span>Demo Workspace · {context.staff.name}</span><Link href="/demo/admin">Admin</Link><Link href="/demo/manager">Manager view</Link><Link href="/">Restaurant</Link></div>
      <div className="min-h-dvh bg-ivory pb-24 lg:pb-8">
        <header className="sticky top-0 z-40 border-b border-night-text/10 bg-teal">
          <div className={`mx-auto flex items-center gap-x-5 px-4 py-2.5 sm:px-6 ${wide ? 'max-w-[1280px]' : 'max-w-[960px]'}`}>
            <Link href="/staff" className="display shrink-0 text-[1.375rem] leading-none text-night-text transition-opacity hover:opacity-80">
              Cosa Nostra
              <span className="ml-1.5 font-sans text-[0.75rem] font-medium normal-case tracking-[0.12em] text-night-text/55">staff</span>
            </Link>
            <StaffTopNav items={items} />
            <div className="ml-auto flex items-center gap-2 text-[0.8125rem]">
              <span className="hidden truncate text-night-text/55 sm:block">{context.location.shortName}</span>
              <Link href="/staff/notifications" aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'} className="relative inline-flex size-10 items-center justify-center rounded-full text-night-text/80 hover:bg-night-text/10">
                <StaffIcon name="bell" className="size-[20px]" />
                {unread > 0 ? <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-coral px-1 text-center text-[0.625rem] font-bold leading-4 text-on-orange">{unread > 9 ? '9+' : unread}</span> : null}
              </Link>
              {manages ? (
                <Link href="/staff/profile" aria-label="Your profile" className="hidden size-10 items-center justify-center rounded-full text-night-text/80 hover:bg-night-text/10 lg:inline-flex">
                  <StaffIcon name="profile" className="size-[20px]" />
                </Link>
              ) : null}
              {context.staff.source !== 'open' ? (
                <form action={signOut}>
                  <button type="submit" className="inline-flex min-h-10 items-center text-night-text/55 underline-offset-4 hover:text-night-text hover:underline">
                    Sign out
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </header>
        {context.previewing ? <PreviewBanner role={OPS_ROLE_LABEL[context.previewing]} /> : null}
        <main className={`mx-auto px-4 py-5 sm:px-6 sm:py-7 ${wide ? 'max-w-[1280px]' : 'max-w-[960px]'}`}>{children}</main>
        <StaffBottomBar items={items} />
      </div>
    </SaveStatusProvider>
  );
}
