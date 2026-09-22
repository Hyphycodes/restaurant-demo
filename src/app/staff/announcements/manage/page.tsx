import { OneTap } from '@/components/staff/forms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Button, Empty, Pill, Row, Screen } from '@/components/staff/ui';
import { formatRelative } from '@/lib/staff/time';
import { archiveAnnouncement } from '@/server/actions/staff/announcements';
import { listAllAnnouncements } from '@/server/staff/announcements';
import { isDenied, staffPage } from '../../_lib';

export const dynamic = 'force-dynamic';

export default async function ManageAnnouncementsPage() {
  const page = await staffPage('announcements.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const announcements = await listAllAnnouncements(db);
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/announcements" label="Announcements" />
      <Screen title="Announcements" lead="What you have posted, and who has read it." actions={<Button href="/staff/announcements/manage/new" variant="primary">New announcement</Button>}>
        {announcements.length === 0 ? <Empty title="Nothing posted yet." /> : (
          <div className="staff-panel px-4">
            {announcements.map((entry) => (
              <div key={entry.id} className="staff-row flex-wrap">
                <div className="min-w-0 flex-1">
                  <Row href={`/staff/announcements/manage/${entry.id}`} title={entry.title} detail={`${entry.publishedAt ? `Posted ${formatRelative(entry.publishedAt)}` : 'Draft'} · ${entry.authorName}${entry.positions.length ? ` · ${entry.positions.join(', ')}` : ''}${entry.eventTitle ? ` · ${entry.eventTitle}` : ''}`} trailing={<span className="flex gap-1">{entry.kind === 'urgent' ? <Pill tone="warn">Urgent</Pill> : null}{entry.audience !== null ? <Pill tone={entry.acknowledged === entry.audience ? 'good' : 'accent'}>{entry.acknowledged}/{entry.audience} {entry.requiresAck ? 'acknowledged' : 'read'}</Pill> : null}</span>} />
                </div>
                <OneTap action={archiveAnnouncement} fields={{ id: entry.id }} variant="quiet" quiet confirm="Take this announcement down?">
                  Take down
                </OneTap>
              </div>
            ))}
          </div>
        )}
      </Screen>
    </StaffShell>
  );
}
