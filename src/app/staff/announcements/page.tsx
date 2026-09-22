import { OneTap } from '@/components/staff/forms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Button, Empty, Pill, Screen } from '@/components/staff/ui';
import { formatRelative } from '@/lib/staff/time';
import { acknowledgeAnnouncement, markAnnouncementRead } from '@/server/actions/staff/notifications';
import { feedFor } from '@/server/staff/announcements';
import { isDenied, staffPage } from '../_lib';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const page = await staffPage('staff.view_self');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const feed = context.employee ? await feedFor(db, context.employee) : [];
  return (
    <StaffShell context={context} unread={unread}>
      <Screen title="Announcements" actions={context.isManager ? <Button href="/staff/announcements/manage" small>Manage</Button> : undefined}>
        {feed.length === 0 ? (
          <Empty title="Nothing new." detail="When a manager posts something, it lands here and on your home screen." />
        ) : (
          <div className="grid gap-3">
            {feed.map((entry) => {
              const outstanding = entry.requiresAck ? !entry.acknowledgedAt : !entry.readAt;
              return (
                <article key={entry.id} className={`staff-panel px-4 py-3.5 ${entry.kind === 'urgent' ? 'border-warning/50' : ''} ${outstanding ? '' : 'opacity-80'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[1rem] font-semibold text-brown">{entry.title}</h2>
                    {entry.kind === 'urgent' ? <Pill tone="warn">Urgent</Pill> : null}
                  </div>
                  <p className="mt-0.5 text-[0.75rem] text-brown-soft">
                    {entry.authorName} · {entry.publishedAt ? formatRelative(entry.publishedAt) : ''}
                    {entry.eventTitle ? ` · ${entry.eventTitle}` : ''}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-[0.9375rem] leading-relaxed text-brown">{entry.body}</p>
                  <div className="mt-3">
                    {entry.requiresAck ? (
                      entry.acknowledgedAt ? (
                        <Pill tone="good">Acknowledged</Pill>
                      ) : (
                        <OneTap action={acknowledgeAnnouncement} fields={{ id: entry.id }}>
                          I have read this
                        </OneTap>
                      )
                    ) : entry.readAt ? null : (
                      <OneTap action={markAnnouncementRead} fields={{ id: entry.id }} variant="quiet" quiet>
                        Mark read
                      </OneTap>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Screen>
    </StaffShell>
  );
}
