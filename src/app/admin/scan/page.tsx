import { DEMO_MODE } from '@/lib/demo';
import { DemoScanner } from '@/components/demo/DemoScanner';
import { redirect } from 'next/navigation';
import { Scanner } from '@/components/admin/Scanner';
import { getReadDb } from '@/lib/db';
import { getUpcomingEvents, venueIsoDate } from '@/lib/events';
import { getStaff, staffCan } from '@/server/auth';
import { getEditableEvents } from '@/server/content/events';

export const dynamic = 'force-dynamic';

/**
 * /admin/scan?event=<id>
 *
 * Full-screen, no shell: the scanner IS the page. Without an event it picks
 * the ticketed event closest to now, which on the night is the one at the door.
 */
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const { event: requested } = await searchParams;

  const db = getReadDb();
  const events = db ? await getEditableEvents(db) : { series: [], occurrences: [] };
  const now = new Date();
  const ticketed = getUpcomingEvents(events, new Date(now.getTime() - 12 * 3_600_000)).filter(
    (event) => event.seriesSlug === null && event.ticketing.enabled && event.overrideId,
  );
  const chosen = ticketed.find((event) => event.overrideId === requested) ?? ticketed.find((event) => venueIsoDate(event.startsAt) === venueIsoDate(now.toISOString())) ?? ticketed[0] ?? null;
  if (!chosen) redirect('/admin/door');

  if (DEMO_MODE) return <DemoScanner eventTitle={chosen.title} />;

  return (
    <Scanner
      eventId={chosen.overrideId!}
      eventTitle={chosen.title}
      deviceLabel={staff.name || staff.email || 'door'}
      canOverride={staffCan(staff, 'content.publish')}
    />
  );
}
