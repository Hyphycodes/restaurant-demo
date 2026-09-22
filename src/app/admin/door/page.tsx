import { redirect } from 'next/navigation';
import { AdminShell, NoAccess } from '@/components/admin/AdminShell';
import { Card, EmptyState, HelpNote, LinkButton } from '@/components/admin/ui';
import { getReadDb, isLocalDb } from '@/lib/db';
import { getUpcomingEvents, venueIsoDate } from '@/lib/events';
import { formatEventDateCompact, formatTimeRangeCompact } from '@/lib/format';
import { getStaff, staffCan } from '@/server/auth';
import { getEditableEvents } from '@/server/content/events';
import { canOpen } from '@/server/permissions';
import { getEventAvailability } from '@/server/ticketing/availability';
import { doorSnapshot } from '@/server/ticketing/insight';
import { DoorLive } from '@/components/admin/DoorLive';
import { DoorSale } from './DoorSale';

export const dynamic = 'force-dynamic';

/**
 * The door: which event is on, how many are in, scan, sell, comp.
 *
 * Built for one phone behind a podium. The event defaults to whatever is on
 * today; the others are a tap away.
 */
export default async function DoorPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  const local = isLocalDb();
  if (!canOpen({ role: staff.role, sections: staff.sections }, 'events')) {
    return (
      <AdminShell staff={staff} local={local} title="Door">
        <NoAccess what="the door" />
      </AdminShell>
    );
  }

  const { event: requested } = await searchParams;
  const db = getReadDb();
  const events = db ? await getEditableEvents(db) : { series: [], occurrences: [] };
  const now = new Date();
  const ticketed = getUpcomingEvents(events, new Date(now.getTime() - 12 * 3_600_000)).filter(
    (event) => event.seriesSlug === null && event.ticketing.enabled && event.overrideId,
  );
  const today = venueIsoDate(now.toISOString());
  const chosen =
    ticketed.find((event) => event.overrideId === requested) ??
    ticketed.find((event) => venueIsoDate(event.startsAt) === today) ??
    ticketed[0] ??
    null;

  const canSell = staffCan(staff, 'content.publish');
  const [availability, snapshot] = chosen
    ? await Promise.all([getEventAvailability(chosen.overrideId!), doorSnapshot(chosen.overrideId!, { withMoney: canSell })])
    : [null, null];

  return (
    <AdminShell
      staff={staff}
      local={local}
      title="Door"
      description={chosen ? `${chosen.title} · ${formatEventDateCompact(chosen.startsAt)} · ${formatTimeRangeCompact(chosen.startsAt, chosen.endsAt)}` : 'Nothing ticketed is on today.'}
      actions={chosen ? <LinkButton href={`/admin/scan?event=${encodeURIComponent(chosen.overrideId!)}`} variant="primary">Start scanning</LinkButton> : undefined}
    >
      {!chosen ? (
        <EmptyState>No event is selling tickets on this website right now. Turn ticketing on for an event to use the door.</EmptyState>
      ) : (
        <div className="grid gap-5">
          {ticketed.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {ticketed.map((event) => (
                <LinkButton key={event.id} href={`/admin/door?event=${encodeURIComponent(event.overrideId!)}`} variant={event.overrideId === chosen.overrideId ? 'primary' : 'secondary'}>
                  {formatEventDateCompact(event.startsAt)} · {event.title}
                </LinkButton>
              ))}
            </div>
          ) : null}

          <Card title="Tonight">
            <DoorLive eventId={chosen.overrideId!} initial={snapshot} />
            {availability ? (
              <p className="mt-4 border-t border-brown/12 pt-3 text-[0.9375rem] text-brown">
                {availability.available === null ? 'No seat cap.' : `${availability.available} seats still for sale.`}
              </p>
            ) : (
              <HelpNote>Live counts need the ticketing connection. Scanning still works from the cached list.</HelpNote>
            )}
          </Card>

          <Card title="Sell at the door">
            {!canSell ? (
              <HelpNote>Only a manager or the owner can sell or comp at the door. You can still scan.</HelpNote>
            ) : availability && availability.tiers.length > 0 ? (
              <DoorSale
                eventId={chosen.overrideId!}
                tiers={availability.tiers.map((tier) => ({ id: tier.id, name: tier.name, priceCents: tier.priceCents, available: tier.available }))}
              />
            ) : (
              <EmptyState>This event has no ticket types yet, or ticketing is not connected.</EmptyState>
            )}
            <p className="mt-4 text-[0.8125rem] leading-relaxed text-brown-soft">
              Take the money at the register as usual. Door and comp sales are counted separately from web sales in the event&apos;s figures.
            </p>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
