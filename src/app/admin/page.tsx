import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { CountUp } from '@/components/admin/CountUp';
import { Card, LinkButton, TaskLink } from '@/components/admin/ui';
import { getSiteSettings } from '@/content/resolve';
import { getReadDb, isLocalDb } from '@/lib/db';
import type { Row } from '@/lib/db/types';
import type { ResolvedEvent } from '@/content/types';
import { getUpcomingEvents, venueIsoDate } from '@/lib/events';
import { formatEventDateCompact, formatPrice, formatTimeRangeCompact } from '@/lib/format';
import { getOpenState } from '@/lib/hours';
import { getStaff } from '@/server/auth';
import { getAttention, housekeepingSentence } from '@/server/content/attention';
import { countNewApplications } from '@/server/content/hiring';
import { countNewTalent } from '@/server/content/talent';
import { getEditableEvents } from '@/server/content/events';
import { getEventAvailability } from '@/server/ticketing/availability';
import { isTicketingConfigured } from '@/server/ticketing/db';
import { getSalesSummaries, type SalesSummary } from '@/server/ticketing/sales';

export const dynamic = 'force-dynamic';

/**
 * Home: a money screen, not a task screen.
 *
 * The first thing on it is what is selling and what is next. Housekeeping is
 * one quiet, uncounted sentence at the bottom. Nothing here is red, nothing
 * says SOON, nothing carries a badge. The only things that get a band at the
 * top are the ones that cost money right now.
 */
export default async function AdminHome() {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  // An employee account's work is in the staff app, not here.
  if (staff.role === 'staff' || staff.role === 'contractor') redirect('/staff');

  const now = new Date();
  const db = getReadDb();
  const [settings, events, attention, inquiries, newApplicants, newTalent] = await Promise.all([
    getSiteSettings(),
    db ? getEditableEvents(db) : { series: [], occurrences: [] },
    db ? getAttention(db, now) : [],
    db ? db.list<Row>('inquiries', { where: { status: 'new' } }) : [],
    db ? countNewApplications(db) : 0,
    db ? countNewTalent(db) : 0,
  ]);

  const upcoming = getUpcomingEvents(events, now).filter((event) => event.seriesSlug === null);
  const next = upcoming[0] ?? null;
  const later = upcoming.slice(1, 6);
  const week = upcoming.filter((event) => Date.parse(event.startsAt) < now.getTime() + 7 * 86_400_000);
  const ids = upcoming.map((event) => event.overrideId!).filter(Boolean);
  const [summaries, nextAvailability] = await Promise.all([
    getSalesSummaries(ids),
    next?.ticketing.enabled && next.overrideId ? getEventAvailability(next.overrideId) : Promise.resolve(null),
  ]);
  const nextSummary = next?.overrideId ? summaries.get(next.overrideId) ?? null : null;

  const weekSold = week.reduce((sum, event) => sum + (summaries.get(event.overrideId ?? '')?.ticketsSold ?? 0), 0);
  const weekCents = week.reduce((sum, event) => sum + (summaries.get(event.overrideId ?? '')?.netCents ?? 0), 0);

  const openState = getOpenState(settings.hours.value, settings.temporaryClosures, now, settings.timeZone);
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: settings.timeZone }).format(now));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = staff.source === 'open' ? '' : `, ${(staff.name || staff.email).split(/[\s@]+/)[0]}`;
  const stateLine = `${openState.open ? `Open now, ${openState.label.toLowerCase()}` : openState.label}. ${
    upcoming.length === 0 ? 'Nothing on the calendar yet.' : upcoming.length === 1 ? 'One event on the calendar.' : `${upcoming.length} events on the calendar.`
  }`;

  // The only things that get a band: what costs money right now.
  const problems = moneyProblems(upcoming, summaries, now, nextAvailability?.tiers.length ?? null);
  const housekeeping = housekeepingSentence(attention.filter((entry) => entry.kind !== 'tickets'));

  // One line, not three badges. Each item is somebody waiting on a reply, and
  // anything with nobody waiting says nothing at all. Labels are written in
  // lower case and the first one is capitalised where it is rendered, because
  // which item comes first depends on what happens to be waiting.
  const waiting: { href: string; label: string }[] = [];
  if (inquiries.length > 0) {
    waiting.push({
      href: '/admin/inquiries',
      label: inquiries.length === 1 ? 'one new enquiry' : `${inquiries.length} new enquiries`,
    });
  }
  if (newApplicants > 0) {
    waiting.push({
      href: '/admin/hiring',
      label: newApplicants === 1 ? 'one job application' : `${newApplicants} job applications`,
    });
  }
  if (newTalent > 0) {
    waiting.push({
      href: '/admin/talent',
      label: newTalent === 1 ? 'one talent submission' : `${newTalent} talent submissions`,
    });
  }

  return (
    <AdminShell staff={staff} local={isLocalDb()} title={`${greeting}${name}.`} description={stateLine}>
      {problems.length > 0 ? (
        <div className="mb-6 grid gap-2">
          {problems.map((problem) => (
            <div key={problem.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-(--radius-md) border border-amber/50 bg-amber/8 px-4 py-3 text-[0.9375rem] text-brown">
              <p className="min-w-0">{problem.message}</p>
              <LinkButton href={problem.href} variant="primary">{problem.action}</LinkButton>
            </div>
          ))}
        </div>
      ) : null}

      {/* Up next — the only bold element. */}
      {next ? (
        <UpNext event={next} summary={nextSummary} tiersKnown={nextAvailability?.tiers.length ?? null} ticketingOn={isTicketingConfigured()} />
      ) : (
        <Card>
          <p className="display text-[clamp(1.5rem,3vw,2rem)] leading-none text-brown">Nothing on the calendar yet.</p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-brown-soft">Want to put something up? A flyer and a date is enough to start.</p>
          <div className="mt-5">
            <LinkButton href="/admin/events/new" variant="primary">Add an event</LinkButton>
          </div>
        </Card>
      )}

      {/* This week, in one line, then the errands. */}
      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-[1rem] font-semibold text-brown">This week</h2>
        <p className="tabular text-[0.9375rem] text-brown-soft">
          {week.length === 0
            ? 'Nothing on this week.'
            : `${formatPrice(weekCents)} in tickets · ${weekSold} sold · ${week.length} ${week.length === 1 ? 'event' : 'events'}`}
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TaskLink href="/admin/events/new" icon="events" title="Add an event" />
        <TaskLink href="/admin/menu" icon="menu" title="Update the menu" />
        <TaskLink href="/admin/link-hubs" icon="hubs" title="Link hubs" />
        <TaskLink href="/admin/media?upload=1" icon="photos" title="Add a photo or video" />
      </div>
      {waiting.length > 0 ? (
        <p className="mt-3 text-[0.9375rem] text-brown-soft">
          {waiting.map((entry, index) => (
            <span key={entry.href}>
              {index > 0 ? (index === waiting.length - 1 ? ' and ' : ', ') : ''}
              <Link href={entry.href} className="font-semibold text-brown underline underline-offset-4">
                {index === 0 ? entry.label[0]!.toUpperCase() + entry.label.slice(1) : entry.label}
              </Link>
            </span>
          ))}{' '}
          to read.
        </p>
      ) : null}

      {later.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[1rem] font-semibold text-brown">Later</h2>
          <ul className="mt-2 divide-y divide-brown/10">
            {later.map((event) => {
              const summary = summaries.get(event.overrideId ?? '');
              return (
                <li key={event.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-[0.9375rem]">
                  <span className="tabular w-20 shrink-0 text-brown-soft">{formatEventDateCompact(event.startsAt).replace(/^\w+ /, '')}</span>
                  <Link href={`/admin/events/one/${encodeURIComponent(event.overrideId ?? '')}`} className="min-w-0 flex-1 truncate font-semibold text-brown underline-offset-4 hover:underline">
                    {event.title}
                  </Link>
                  <span className="tabular text-brown-soft">{soldLine(event, summary)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {housekeeping ? (
        <p className="mt-10 border-t border-brown/10 pt-5 text-[0.9375rem] leading-relaxed text-brown-soft">
          {housekeeping}{' '}
          <Link href="/admin/tidy" className="underline underline-offset-4 hover:text-brown">
            See the list
          </Link>
        </p>
      ) : null}
    </AdminShell>
  );
}

function soldLine(event: ResolvedEvent, summary: SalesSummary | undefined): string {
  if (!event.published) return 'draft';
  if (!event.ticketing.enabled) return event.ticketUrl ? 'on Tickeri' : 'not on sale';
  if (!summary) return 'not on sale yet';
  return summary.capacity ? `${summary.ticketsSold} of ${summary.capacity}` : `${summary.ticketsSold} sold`;
}

function UpNext({
  event,
  summary,
  tiersKnown,
  ticketingOn,
}: {
  event: ResolvedEvent;
  summary: SalesSummary | null;
  tiersKnown: number | null;
  ticketingOn: boolean;
}) {
  const inHouse = event.ticketing.enabled;
  const capacity = summary?.capacity ?? event.ticketing.capacity ?? null;
  const sold = summary?.ticketsSold ?? 0;
  const left = capacity !== null ? Math.max(0, capacity - (summary?.seatsTaken ?? 0)) : null;
  const percent = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
  const isToday = venueIsoDate(event.startsAt) === venueIsoDate(new Date().toISOString());
  const editHref = `/admin/events/one/${encodeURIComponent(event.overrideId ?? '')}`;
  const salesHref = `/admin/events/${encodeURIComponent(event.overrideId ?? '')}/sales`;

  return (
    <section aria-labelledby="up-next" className="admin-raised rounded-(--radius-lg) border border-brown/12 bg-linen p-5 sm:p-7">
      <p id="up-next" className="text-[0.8125rem] font-semibold text-brown-soft">
        Up next · {isToday ? 'Today' : formatEventDateCompact(event.startsAt)}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="display text-[clamp(1.75rem,3.4vw,2.5rem)] leading-none text-brown">{event.title}</h2>
        <p className="tabular text-[1rem] text-brown-soft">{formatTimeRangeCompact(event.startsAt, event.endsAt)}</p>
      </div>

      {inHouse && summary ? (
        <>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-brown/10" role="img" aria-label={capacity ? `${sold} of ${capacity} sold` : `${sold} sold`}>
            <div className="h-full rounded-full bg-amber" style={{ width: `${capacity ? percent : sold > 0 ? 100 : 0}%` }} />
          </div>
          <p className="admin-figure mt-3 text-[clamp(2rem,5vw,3rem)] text-brown">
            <CountUp value={sold} />
            {capacity ? <span className="text-brown-soft"> of {capacity} sold</span> : <span className="text-brown-soft"> sold</span>}
          </p>
          <p className="tabular mt-2 text-[0.9375rem] text-brown-soft">
            {formatPrice(summary.netCents)} collected
            {left !== null ? ` · ${left} left` : ''}
            {summary.lastSaleAt ? ` · last sale ${ago(summary.lastSaleAt)}` : ' · no sales yet'}
            {summary.doorCents > 0 ? ` · ${formatPrice(summary.doorCents)} at the door` : ''}
          </p>
        </>
      ) : inHouse ? (
        <p className="mt-5 text-[0.9375rem] leading-relaxed text-brown-soft">
          {!ticketingOn
            ? 'Ticket sales are not connected on this copy of the site.'
            : tiersKnown === 0
              ? 'Ticketing is on but nothing is priced yet.'
              : 'No sales yet.'}
        </p>
      ) : (
        <p className="mt-5 text-[0.9375rem] leading-relaxed text-brown-soft">
          {event.ticketUrl ? 'Tickets are sold on Tickeri, so sales are not counted here.' : 'Not on sale.'}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {inHouse ? <LinkButton href={salesHref} variant="primary">Open door list</LinkButton> : null}
        <LinkButton href={editHref} variant={inHouse ? 'secondary' : 'primary'}>Edit event</LinkButton>
        {inHouse ? <LinkButton href={`/admin/door?event=${encodeURIComponent(event.overrideId ?? '')}`} variant="secondary">Door</LinkButton> : null}
      </div>
    </section>
  );
}

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/**
 * Real problems: only things that cost money right now.
 * Anything else is housekeeping, and if it is not clear which, it is housekeeping.
 */
function moneyProblems(
  upcoming: ResolvedEvent[],
  summaries: Map<string, SalesSummary>,
  now: Date,
  nextTiers: number | null,
): { id: string; message: string; href: string; action: string }[] {
  const problems: { id: string; message: string; href: string; action: string }[] = [];
  const next = upcoming[0];
  if (next?.published && next.ticketing.enabled && nextTiers === 0) {
    problems.push({
      id: 'no-tiers',
      message: `${next.title} is on sale with nothing priced. Guests can see it but cannot buy.`,
      href: `/admin/events/one/${encodeURIComponent(next.overrideId ?? '')}`,
      action: 'Add a ticket price',
    });
  }
  for (const event of upcoming) {
    if (!event.ticketing.enabled || !event.overrideId) continue;
    const summary = summaries.get(event.overrideId);
    const started = Date.parse(event.startsAt);
    if (summary && summary.ticketsSold > 0 && summary.checkedIn === 0 && now.getTime() > started + 30 * 60_000 && now.getTime() < Date.parse(event.endsAt)) {
      problems.push({
        id: `no-checkins-${event.id}`,
        message: `${event.title} started half an hour ago and nobody has been checked in yet.`,
        href: `/admin/scan?event=${encodeURIComponent(event.overrideId)}`,
        action: 'Open the scanner',
      });
    }
  }
  return problems;
}
