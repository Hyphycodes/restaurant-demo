import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { StaffShell } from '@/components/staff/StaffShell';
import { Empty, Screen } from '@/components/staff/ui';
import { opsReadDb } from '@/server/staff/db';
import { unreadCount } from '@/server/staff/notifications';
import type { OpsCapability } from '@/server/staff/permissions';
import { contextCan, getStaffContext, type StaffContext } from '@/server/staff/session';
import type { Db } from '@/lib/db/types';

/**
 * What every staff page does first: who is this, may they be here, and where
 * is the database. Returned as one object so a page is three lines of setup
 * and then its content.
 */
export interface StaffPage {
  context: StaffContext;
  db: Db;
  unread: number;
}

export async function staffPage(capability: OpsCapability = 'staff.view_self'): Promise<StaffPage | { denied: ReactNode }> {
  const context = await getStaffContext();
  if (!context) redirect('/admin/login?next=/staff');
  // A contractor is not a small employee — they have their own app, which is
  // one screen. Sending them there beats showing them an employee shell with
  // everything greyed out.
  if (context.opsRole === 'contractor') redirect('/staff/bookings');
  const db = opsReadDb();
  const unread = context.employee && db ? await unreadCount(db, context.employee.id).catch(() => 0) : 0;
  if (!db) {
    return {
      denied: (
        <StaffShell context={context} unread={unread}>
          <Screen title="Not connected yet">
            <Empty title="The staff system is not connected." detail="A developer needs to finish the setup in docs/ENVIRONMENT.md." />
          </Screen>
        </StaffShell>
      ),
    };
  }
  if (!contextCan(context, capability)) {
    return {
      denied: (
        <StaffShell context={context} unread={unread}>
          <Screen title={context.opsRole === 'none' ? 'Almost there' : 'Not for your account'}>
            <Empty
              title={context.opsRole === 'none' ? 'Your account is not set up as an employee yet.' : 'Your account cannot open this.'}
              detail={
                context.opsRole === 'none'
                  ? 'Ask a manager to add you to the team, and this becomes your schedule, training and shifts.'
                  : context.previewing
                    ? 'You are previewing a role that cannot open this — which is the point. Exit the preview to carry on.'
                    : 'If you need it, ask a manager.'
              }
            />
          </Screen>
        </StaffShell>
      ),
    };
  }
  return { context, db, unread };
}

export function isDenied(page: StaffPage | { denied: ReactNode }): page is { denied: ReactNode } {
  return 'denied' in page;
}

/** Upcoming standalone events as select options, soonest first. */
export async function eventOptionsFor(db: Db, timezone: string, days = 60): Promise<{ id: string; label: string }[]> {
  const { listEventsBetween } = await import('@/server/staff/events');
  const { formatDayShort } = await import('@/lib/staff/time');
  const now = new Date();
  const events = await listEventsBetween(db, new Date(now.getTime() - 86_400_000).toISOString(), new Date(now.getTime() + days * 86_400_000).toISOString());
  return events.map((event) => ({ id: event.id, label: `${formatDayShort(event.startsAt, timezone)} · ${event.title}` }));
}
