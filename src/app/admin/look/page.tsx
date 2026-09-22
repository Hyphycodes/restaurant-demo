import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { TaskLink } from '@/components/admin/ui';
import { isLocalDb } from '@/lib/db';
import { getUpcomingEvents } from '@/lib/events';
import { getAppearance } from '@/server/appearance';
import { getStaff, staffCan } from '@/server/auth';
import { getPublicEvents } from '@/server/content/events';
import { canOpen } from '@/server/permissions';
import { LookEditor } from './LookEditor';

export const dynamic = 'force-dynamic';

/**
 * Look: how the website and the admin look, in one place.
 *
 * Four presets, two dials, a season, and the real site beside them. The
 * seasonal schedule and the photo library are the other two screens in this
 * section.
 */
export default async function LookPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'website')) {
    return (
      <AdminShell staff={staff} local={local} title="Look">
        <NoAccess what="the website's look" />
      </AdminShell>
    );
  }
  const [appearance, events] = await Promise.all([getAppearance(), getPublicEvents()]);
  const sample = getUpcomingEvents(events, new Date()).find((event) => event.seriesSlug === null && event.slug) ?? null;

  return (
    <AdminShell staff={staff} local={local} title="Look" description="Change how the website looks, see it live, and never be able to make it unreadable.">
      <LookEditor saved={appearance} eventSlug={sample?.slug ?? null} canPublish={staffCan(staff, 'content.publish')} />
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <TaskLink href="/admin/theme" icon="season" title="Seasonal schedule" hint="Set the dates a season switches itself on and off." />
        <TaskLink href="/admin/media" icon="photos" title="Photos & videos" hint="Add a file once, then choose where it appears." />
      </div>
    </AdminShell>
  );
}
