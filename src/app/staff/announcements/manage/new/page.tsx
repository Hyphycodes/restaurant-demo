import { AnnouncementForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Screen } from '@/components/staff/ui';
import { listPositions } from '@/server/staff/employees';
import { eventOptionsFor, isDenied, staffPage } from '../../../_lib';

export const dynamic = 'force-dynamic';

export default async function NewAnnouncementPage() {
  const page = await staffPage('announcements.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const [positions, events] = await Promise.all([listPositions(db), eventOptionsFor(db, context.location.timezone)]);
  return (
    <StaffShell context={context} unread={unread}>
      <Back href="/staff/announcements/manage" label="Announcements" />
      <Screen title="New announcement">
        <AnnouncementForm announcement={null} locations={context.locations} positions={positions.filter((position) => position.active)} events={events} />
      </Screen>
    </StaffShell>
  );
}
