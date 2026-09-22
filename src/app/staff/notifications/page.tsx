import Link from 'next/link';
import { OneTap } from '@/components/staff/forms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Empty, Screen } from '@/components/staff/ui';
import { formatRelative } from '@/lib/staff/time';
import { markAllRead } from '@/server/actions/staff/notifications';
import { listNotifications } from '@/server/staff/notifications';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const page = await staffPage('staff.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const notifications = context.employee ? await listNotifications(db, context.employee.id) : [];
  return (
    <StaffShell context={context} unread={unread}>
      <Screen
        title="Notifications"
        actions={
          unread > 0 ? (
            <OneTap action={markAllRead} fields={{}} variant="secondary" quiet>
              Mark all read
            </OneTap>
          ) : undefined
        }
      >
        {notifications.length === 0 ? (
          <Empty title="Nothing yet." detail="A published schedule, a shift change, a decision on time off — they all land here." />
        ) : (
          <div className="staff-panel px-4">
            {notifications.map((notification) => {
              const body = (
                <>
                  <span aria-hidden="true" className={`mt-2 size-2 shrink-0 rounded-full ${notification.readAt ? 'bg-transparent' : 'bg-amber'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[0.9375rem] ${notification.readAt ? 'text-brown-soft' : 'font-semibold text-brown'}`}>{notification.title}</span>
                    {notification.body ? <span className="block text-[0.875rem] text-brown-soft">{notification.body}</span> : null}
                    <span className="block text-[0.75rem] text-brown-soft/80">{formatRelative(notification.createdAt)}</span>
                  </span>
                </>
              );
              return notification.href ? (
                <Link key={notification.id} href={notification.href} className="staff-row -mx-1 items-start px-1 active:bg-brown/6">
                  {body}
                </Link>
              ) : (
                <div key={notification.id} className="staff-row items-start">
                  {body}
                </div>
              );
            })}
          </div>
        )}
      </Screen>
    </StaffShell>
  );
}
