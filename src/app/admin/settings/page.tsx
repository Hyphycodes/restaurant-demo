import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, Notice } from '@/components/admin/ui';
import { getSiteSettings } from '@/content/resolve';
import { getReadDb, isLocalDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import { getStaff, staffCan } from '@/server/auth';
import { AnnouncementEditor, BusinessDetails, HoursEditor, SpecialDays } from './SettingsForms';

export const dynamic = 'force-dynamic';

/**
 * Settings, grouped by what someone is trying to do rather than by table.
 *
 * Everything here is written once and read everywhere — the homepage, /visit, the
 * footer, the structured data and the calendar links all come from this record,
 * which is why they cannot drift apart.
 */
export default async function SettingsPage() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');

  const local = isLocalDb();
  if (!staffCan(staff, 'settings.manage')) {
    return (
      <AdminShell staff={staff} local={local} title="Hours & contact">
        <NoAccess what="the restaurant details" />
      </AdminShell>
    );
  }

  const db = getReadDb();
  const settings = await getSiteSettings();
  const specials = db ? await db.list<Row>('special_hours', { orderBy: 'on_date' }) : [];
  const announcements = db ? await db.list<Row>('announcements', { orderBy: 'updated_at', desc: true }) : [];
  const banner = announcements[0];

  const today = new Date().toISOString().slice(0, 10);
  const upcomingSpecials = specials.filter((row) => String(row.on_date) >= today);

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Hours & contact"
      description="Change these details once and they update everywhere on the website."
    >
      <div className="grid gap-5">
        {settings.phone.provisional || settings.hours.provisional ? (
          <Notice tone="warning">
            The phone number and hours came from two sources that disagreed. Confirm them below and
            the warning goes away.
          </Notice>
        ) : null}

        <Card title="Location & contact">
          <BusinessDetails settings={settings} />
        </Card>

        <Card title="Opening hours">
          <HoursEditor hours={settings.hours.value} />
        </Card>

        <Card title="Holidays and one-off changes">
          <SpecialDays
            days={upcomingSpecials.map((row) => ({
              id: String(row.id),
              date: String(row.on_date),
              closed: Boolean(row.closed),
              note: String(row.note ?? ''),
            }))}
          />
        </Card>

        <Card title="Banner across the top of the website">
          <AnnouncementEditor
            announcement={
              banner
                ? {
                    id: String(banner.id),
                    message: String(banner.message),
                    href: (banner.href as string | null) ?? '',
                    linkLabel: (banner.link_label as string | null) ?? '',
                    enabled: Boolean(banner.enabled),
                    tone: String(banner.tone ?? 'default') as 'default' | 'night',
                  }
                : null
            }
          />
        </Card>

        <Card title="Ordering, booking & social links" tone="quiet">
          <p className="measure text-[0.9375rem] leading-relaxed text-brown-soft">
            Change a link here and every matching button on the website updates automatically.
          </p>
        </Card>
      </div>
    </AdminShell>
  );
}
