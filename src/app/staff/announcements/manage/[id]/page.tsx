import { notFound } from 'next/navigation';
import { AnnouncementForm } from '@/components/staff/manage/MoreForms';
import { StaffShell } from '@/components/staff/StaffShell';
import { Back, Chips, Pill, Row, Screen, Section } from '@/components/staff/ui';
import { formatRelative } from '@/lib/staff/time';
import { listAllAnnouncements, whoAcknowledged } from '@/server/staff/announcements';
import { listPositions } from '@/server/staff/employees';
import { eventOptionsFor, isDenied, staffPage } from '../../../_lib';

export const dynamic = 'force-dynamic';

export default async function AnnouncementDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const page = await staffPage('announcements.manage');
  if (isDenied(page)) return page.denied;
  const { context, db, unread } = page;
  const { id } = await params;
  const { tab } = await searchParams;
  const announcement = (await listAllAnnouncements(db)).find((entry) => entry.id === id);
  if (!announcement) notFound();
  const [readers, positions, events] = await Promise.all([whoAcknowledged(db, id), listPositions(db), eventOptionsFor(db, context.location.timezone)]);
  const done = readers.filter((reader) => (announcement.requiresAck ? reader.acknowledgedAt : reader.readAt));
  const notYet = readers.filter((reader) => !done.includes(reader));
  return (
    <StaffShell context={context} unread={unread} wide>
      <Back href="/staff/announcements/manage" label="Announcements" />
      <Screen title={announcement.title} eyebrow={announcement.publishedAt ? `Posted ${formatRelative(announcement.publishedAt)}` : 'Draft'}>
        <Chips items={[{ href: `/staff/announcements/manage/${id}`, label: 'Who has read it', active: tab !== 'edit' }, { href: `/staff/announcements/manage/${id}?tab=edit`, label: 'Edit', active: tab === 'edit' }]} />
        {tab === 'edit' ? (
          <AnnouncementForm announcement={announcement} locations={context.locations} positions={positions.filter((position) => position.active)} events={events} />
        ) : (
          <>
            <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed text-brown">{announcement.body}</p>
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title={announcement.requiresAck ? 'Acknowledged' : 'Read'} count={done.length}>
                {done.length === 0 ? <p className="text-[0.875rem] text-brown-soft">Nobody yet.</p> : (
                  <div className="staff-panel px-4">
                    {done.map((reader) => (
                      <Row key={reader.employee.id} href={`/staff/team/${reader.employee.id}`} title={reader.employee.displayName} detail={formatRelative((reader.acknowledgedAt ?? reader.readAt)!)} trailing={<Pill tone="good">✓</Pill>} />
                    ))}
                  </div>
                )}
              </Section>
              <Section title="Not yet" count={notYet.length}>
                {notYet.length === 0 ? <p className="text-[0.875rem] text-brown-soft">Everyone has.</p> : (
                  <div className="staff-panel px-4">
                    {notYet.map((reader) => (
                      <Row key={reader.employee.id} href={`/staff/team/${reader.employee.id}`} title={reader.employee.displayName} detail={reader.readAt ? 'Read, not acknowledged' : 'Not opened'} trailing={<Pill tone="warn">—</Pill>} />
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </>
        )}
      </Screen>
    </StaffShell>
  );
}
